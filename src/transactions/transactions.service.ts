import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { Prisma } from '@prisma/client';
import {
  TransactionCalendarItem,
  TransactionDTO,
  TransactionSummary,
  TransactionSummaryDTO,
} from './dto/transaction.dto';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { getUserTimezone } from '@/libs/timezone';
import { TransactionCreateDTO } from './dto/transaction-create.dto';
import { TransactionUpdateDTO } from './dto/transaction-update.dto';
import {
  DateQueryDTO,
  SummaryRangeQueryDTO,
  TransactionFilterDTO,
} from './dto/transaction-filter.dto';
import { TransactionTransferDTO } from './dto/transaction-transfer.dto';
import {
  getDateRangeAndLabelByGroup,
  getLocalDate,
  getUTCDate,
} from '@/libs/date.util';

export type TransactionFilterWhereInput = Prisma.TransactionWhereInput;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(userId: string, dto: TransactionCreateDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException('계좌를 찾을 수 없습니다.');
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 생성
      const created = await tx.transaction.create({
        data: {
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          note: dto.note,
          description: dto.description,
          date: getUTCDate(dto.date, timezone),
          userId,
        },
      });

      // ✅ 계좌 잔액 재계산
      await this.recalculateAccountBalanceInTx(tx, dto.accountId);

      return created;
    });

    // ✅ 예산 초과 경고는 트랜잭션 외부에서 처리
    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId: dto.categoryId,
        budget: { userId },
      },
    });

    if (budgetItem) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          categoryId: dto.categoryId,
          userId,
          type: 'expense',
        },
        _sum: { amount: true },
      });

      const totalSpent = spent._sum.amount || 0;
      if (totalSpent > budgetItem.amount) {
        const exceed = totalSpent - budgetItem.amount;
        this.eventsGateway.emitBudgetAlert(userId, {
          category: category.name,
          message: `예산 초과! ₩${exceed}`,
        });
      }
    }

    return transaction;
  }

  async update(userId: string, id: string, dto: TransactionUpdateDTO) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('거래를 찾을 수 없습니다.');

    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.accountId && { accountId: dto.accountId }),
          ...(dto.date && { date: getUTCDate(dto.date, timezone) }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      // ✅ 기존 계좌 잔액 재계산
      await this.recalculateAccountBalanceInTx(tx, existing.accountId);

      // ✅ 계좌가 변경된 경우 새 계좌도 재계산
      if (dto.accountId && dto.accountId !== existing.accountId) {
        await this.recalculateAccountBalanceInTx(tx, dto.accountId);
      }

      return updated;
    });

    return updatedTransaction;
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('거래를 찾을 수 없습니다.');
    }

    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 삭제
      await tx.transaction.delete({
        where: { id },
      });

      // ✅ 잔액 재계산 (기존 계좌)
      await this.recalculateAccountBalanceInTx(tx, existing.accountId);

      // ✅ transfer인 경우 입금 계좌도 재계산 필요
      if (existing.type === 'transfer' && existing.toAccountId) {
        await this.recalculateAccountBalanceInTx(tx, existing.toAccountId);
      }
    });
  }

  async getTransactionById(userId: string, transactionId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true, account: true },
    });

    if (!tx || tx.userId !== userId)
      throw new ForbiddenException('Access denied');

    return tx;
  }

  async findFiltered(userId: string, filter: TransactionFilterDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    const where: TransactionFilterWhereInput = {
      userId,
      ...(filter.type && { type: filter.type }),
      ...(filter.categoryId && { categoryId: filter.categoryId }),
      ...(filter.search && {
        note: { contains: filter.search, mode: 'insensitive' },
      }),
    };

    if (filter.startDate || filter.endDate) {
      const start = filter.startDate
        ? getLocalDate(filter.startDate, timezone)
        : undefined;
      const end = filter.endDate
        ? getLocalDate(filter.endDate, timezone)
        : undefined;
      where.date = { ...(start && { gte: start }), ...(end && { lte: end }) };
    }

    const sortField = filter.sort ?? 'date';
    const sortOrder = filter.order ?? 'desc';
    const skip = ((filter.page ?? 1) - 1) * (filter.limit ?? 20);

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: filter.limit ?? 20,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note ?? '',
      description: tx.description ?? '',
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? undefined,
      linkedTransferId: tx.linkedTransferId ?? undefined,
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            type: tx.category.type,
            color: tx.category.color ?? '',
          }
        : undefined,
      account: {
        id: tx.account.id,
        name: tx.account.name,
        type: tx.account.type,
        color: tx.account.color ?? undefined,
      },
      toAccount: tx.toAccount
        ? {
            id: tx.toAccount.id,
            name: tx.toAccount.name,
            type: tx.toAccount.type,
            color: tx.toAccount.color ?? undefined,
          }
        : undefined,
    }));
  }

  async getTransactionSummary(
    userId: string,
    query: SummaryRangeQueryDTO,
  ): Promise<TransactionSummaryDTO> {
    const { groupBy, startDate, endDate } = query;

    // 1️⃣ 유저 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const start = getLocalDate(startDate, timezone);
    const end = getLocalDate(endDate, timezone);

    // 2️⃣ 해당 기간의 모든 트랜잭션 조회 (income/expense/transfer만)
    const allTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }, { type: 'transfer' }],
      },
      orderBy: { date: 'asc' },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    // 3️⃣ 트랜스퍼 중 입금 트랜잭션(toAccountId === null)은 제외
    const transactions = allTx.filter((tx) =>
      tx.type === 'transfer' ? tx.toAccountId !== null : true,
    );

    // 4️⃣ 그룹화 및 요약 데이터 생성
    const grouped = new Map<
      string,
      { rangeStart: string; rangeEnd: string; transactions: TransactionDTO[] }
    >();

    for (const tx of transactions) {
      const { label, rangeStart, rangeEnd } = getDateRangeAndLabelByGroup(
        tx.date,
        groupBy,
        timezone,
      );

      if (!grouped.has(label)) {
        grouped.set(label, {
          rangeStart: format(rangeStart, 'yyyy-MM-dd'),
          rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
          transactions: [],
        });
      }

      grouped.get(label)!.transactions.push({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        note: tx.note ?? '',
        description: tx.description ?? '',
        accountId: tx.accountId,
        toAccountId: tx.toAccountId ?? undefined,
        linkedTransferId: tx.linkedTransferId ?? undefined,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        category: tx.category
          ? {
              id: tx.category.id,
              name: tx.category.name,
              icon: tx.category.icon,
              type: tx.category.type,
              color: tx.category.color ?? '',
            }
          : undefined,
        account: {
          id: tx.account.id,
          name: tx.account.name,
          type: tx.account.type,
          color: tx.account.color ?? undefined,
        },
        toAccount: tx.toAccount
          ? {
              id: tx.toAccount.id,
              name: tx.toAccount.name,
              type: tx.toAccount.type,
              color: tx.toAccount.color ?? undefined,
            }
          : undefined,
      });
    }

    // 5️⃣ 요약 데이터 계산
    const data: TransactionSummary[] = [];
    let incomeTotal = 0;
    let expenseTotal = 0;

    for (const [label, { rangeStart, rangeEnd, transactions }] of grouped) {
      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      incomeTotal += income;
      expenseTotal += expense;

      data.push({
        label,
        rangeStart,
        rangeEnd,
        incomeTotal: income,
        expenseTotal: expense,
        transactions,
      });
    }

    // 6️⃣ 결과 반환
    return {
      type: groupBy,
      startDate,
      endDate,
      incomeTotal,
      expenseTotal,
      data,
    };
  }

  async getTransactionCalendarView(
    userId: string,
    query: DateQueryDTO,
  ): Promise<TransactionCalendarItem[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const timezone = getUserTimezone(user);

    const { year, month } = query;
    const base = new Date(Number(year), Number(month) - 1);
    const { rangeStart, rangeEnd } = getDateRangeAndLabelByGroup(
      base,
      'monthly',
      timezone,
    );

    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: { userId, date: { gte: rangeStart, lte: rangeEnd } },
      _sum: { amount: true },
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const g of grouped) {
      const local = toZonedTime(g.date, timezone);
      const key = format(local, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const item = map.get(key)!;
      if (g.type === 'income') item.income += g._sum.amount ?? 0;
      if (g.type === 'expense') item.expense += g._sum.amount ?? 0;
    }

    return Array.from(map.entries()).map(([date, value]) => ({
      date,
      income: value.income,
      expense: value.expense,
    }));
  }

  async createTransfer(userId: string, dto: TransactionTransferDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌 간 이체는 허용되지 않습니다.');
    }

    return await this.prisma
      .$transaction(async (tx) => {
        // ✅ 계좌 확인
        const [fromAccount, toAccount] = await Promise.all([
          tx.account.findUnique({ where: { id: fromAccountId } }),
          tx.account.findUnique({ where: { id: toAccountId } }),
        ]);

        if (!fromAccount || !toAccount) {
          throw new NotFoundException(
            '출금 또는 입금 계좌를 찾을 수 없습니다.',
          );
        }

        if (fromAccount.userId !== userId || toAccount.userId !== userId) {
          throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
        }

        // ✅ 자산 계좌 출금 시 잔액 체크
        if (fromAccount.type !== 'CARD' && fromAccount.balance < amount) {
          throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
        }

        // ✅ 트랜스퍼 트랜잭션 생성 (출금 → 입금)
        const outTx = await tx.transaction.create({
          data: {
            type: 'transfer',
            amount,
            userId,
            accountId: fromAccountId,
            toAccountId,
            date: getUTCDate(date, timezone),
            note,
            description,
          },
        });

        const inTx = await tx.transaction.create({
          data: {
            type: 'transfer',
            amount,
            userId,
            accountId: toAccountId,
            toAccountId: null,
            linkedTransferId: outTx.id,
            date: getUTCDate(date, timezone),
            note,
            description,
          },
        });

        // ✅ 상호 연결
        await tx.transaction.update({
          where: { id: outTx.id },
          data: { linkedTransferId: inTx.id },
        });

        return { outgoing: outTx, incoming: inTx };
      })
      .then(async (result) => {
        // ✅ 트랜잭션 후 잔액 재계산 (유틸 활용)
        await Promise.all([
          this.recalculateAccountBalance(fromAccountId),
          this.recalculateAccountBalance(toAccountId),
        ]);

        return result;
      })
      .catch((err) => {
        this.logger.error('❌ createTransfer 실패:', err);
        throw new Error('이체 중 오류가 발생했습니다.');
      });
  }

  async updateTransfer(
    userId: string,
    id: string,
    dto: TransactionTransferDTO,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌로 이체할 수 없습니다.');
    }

    const original = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!original || original.userId !== userId) {
      throw new NotFoundException('수정할 트랜잭션을 찾을 수 없습니다.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('계좌 정보를 찾을 수 없습니다.');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
      }

      const fromIsCard = fromAccount.type === 'CARD';

      if (!fromIsCard) {
        const simulated = fromAccount.balance + original.amount - amount;
        if (simulated < 0) {
          throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
        }
      }

      // 기존 입금 트랜잭션 제거
      if (original.type === 'transfer' && original.linkedTransferId) {
        await tx.transaction.delete({
          where: { id: original.linkedTransferId },
        });
      }

      // 새 입금 트랜잭션 생성
      const incoming = await tx.transaction.create({
        data: {
          type: 'transfer',
          userId,
          amount,
          accountId: toAccountId,
          toAccountId: null,
          linkedTransferId: original.id,
          date: getUTCDate(date, timezone),
          note,
          description,
        },
      });

      // 기존 출금 트랜잭션 업데이트
      const outgoing = await tx.transaction.update({
        where: { id },
        data: {
          type: 'transfer',
          amount,
          accountId: fromAccountId,
          toAccountId,
          linkedTransferId: incoming.id,
          date: getUTCDate(date, timezone),
          note,
          description,
          categoryId: null,
        },
      });

      // ✅ 잔액 재계산
      await Promise.all([
        this.recalculateAccountBalanceInTx(tx, fromAccountId),
        this.recalculateAccountBalanceInTx(tx, toAccountId),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });
  }
  async deleteTransfer(userId: string, id: string) {
    const outgoing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (
      !outgoing ||
      outgoing.type !== 'transfer' ||
      outgoing.userId !== userId
    ) {
      throw new NotFoundException('삭제할 트랜잭션을 찾을 수 없습니다.');
    }

    const incoming = await this.prisma.transaction.findUnique({
      where: { id: outgoing.linkedTransferId ?? undefined },
      include: { account: true },
    });

    if (!incoming) {
      throw new NotFoundException('연결된 입금 트랜잭션을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 삭제
      await tx.transaction.deleteMany({
        where: {
          id: { in: [outgoing.id, incoming.id] },
        },
      });

      // ✅ 잔액 재계산
      await Promise.all([
        this.recalculateAccountBalanceInTx(tx, outgoing.accountId),
        this.recalculateAccountBalanceInTx(tx, incoming.accountId),
      ]);
    });

    return { success: true };
  }

  async recalculateAccountBalance(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('계좌를 찾을 수 없습니다.');

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { accountId },
          { toAccountId: accountId }, // 카드 입금 고려
        ],
      },
    });

    let newBalance = 0;

    for (const tx of transactions) {
      if (tx.type === 'income' && tx.accountId === accountId) {
        newBalance += tx.amount;
      } else if (tx.type === 'expense' && tx.accountId === accountId) {
        newBalance -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId && tx.toAccountId) {
          // 출금
          newBalance -= tx.amount;
        } else if (tx.toAccountId === accountId) {
          // 입금
          newBalance += tx.amount;
        }
      }
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { balance: newBalance },
    });

    return newBalance;
  }

  private async recalculateAccountBalanceInTx(
    tx: Prisma.TransactionClient,
    accountId: string,
  ) {
    const transactions = await tx.transaction.findMany({
      where: {
        OR: [{ accountId }, { toAccountId: accountId }],
      },
    });

    let balance = 0;

    for (const tx of transactions) {
      if (tx.type === 'income' && tx.accountId === accountId) {
        balance += tx.amount;
      } else if (tx.type === 'expense' && tx.accountId === accountId) {
        balance -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId && tx.toAccountId) {
          // 출금 트랜스퍼
          balance -= tx.amount;
        } else if (tx.toAccountId === accountId) {
          // 입금 트랜스퍼
          balance += tx.amount;
        }
      }
    }

    await tx.account.update({
      where: { id: accountId },
      data: { balance },
    });

    return balance;
  }
}
