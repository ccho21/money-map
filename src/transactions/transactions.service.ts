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
  toUTC,
} from '@/libs/date.util';
import { UserPayload } from '@/auth/types/user-payload.type';
import { groupBy } from 'rxjs';

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
    if (!category) throw new NotFoundException('카테고리를 찾을 수 없습니다.');

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('계좌를 찾을 수 없습니다.');

    const isCard = account.type === 'CARD';

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
          date: toUTC(dto.date, timezone),
          userId,
        },
      });

      // ✅ 계좌 잔액 반영
      const newBalance = (() => {
        if (dto.type === 'income') {
          return isCard
            ? account.balance - dto.amount // 카드 수입은 부채 감소
            : account.balance + dto.amount;
        }
        if (dto.type === 'expense') {
          return isCard
            ? account.balance + dto.amount // 카드 지출은 부채 증가
            : account.balance - dto.amount;
        }
        return account.balance;
      })();

      await tx.account.update({
        where: { id: dto.accountId },
        data: { balance: newBalance },
      });

      return created;
    });

    // ✅ 예산 초과 경고는 트랜잭션 외부 (성능 + 실시간 처리)
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('수정할 거래를 찾을 수 없습니다.');
    }

    // transfer는 updateTransfer에서 처리해야 함
    if (existing.type === 'transfer') {
      throw new BadRequestException('트랜스퍼 거래는 별도 API를 사용하세요.');
    }

    const timezone = getUserTimezone(user);

    return await this.prisma.$transaction(async (tx) => {
      const oldAccount = await tx.account.findUnique({
        where: { id: existing.accountId },
      });
      const newAccountId = dto.accountId ?? existing.accountId;
      const newAccount = await tx.account.findUnique({
        where: { id: newAccountId },
      });

      if (!oldAccount || !newAccount) {
        throw new NotFoundException('계좌 정보를 찾을 수 없습니다.');
      }

      const isOldCard = oldAccount.type === 'CARD';
      const isNewCard = newAccount.type === 'CARD';

      const oldAmount = existing.amount;
      const newAmount = dto.amount ?? oldAmount;

      const newType = dto.type ?? existing.type;

      // ✅ 기존 금액 복원 (원상복구)
      const restoredOldBalance = (() => {
        if (existing.type === 'income') {
          return isOldCard
            ? oldAccount.balance - oldAmount
            : oldAccount.balance - oldAmount;
        }
        if (existing.type === 'expense') {
          return isOldCard
            ? oldAccount.balance + oldAmount
            : oldAccount.balance + oldAmount;
        }
        return oldAccount.balance;
      })();

      // ✅ 새로운 금액 적용
      const updatedNewBalance = (() => {
        if (newType === 'income') {
          return isNewCard
            ? newAccount.balance + newAmount
            : newAccount.balance + newAmount;
        }
        if (newType === 'expense') {
          return isNewCard
            ? newAccount.balance - newAmount
            : newAccount.balance - newAmount;
        }
        return newAccount.balance;
      })();

      // ✅ 트랜잭션 업데이트
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.accountId && { accountId: dto.accountId }),
          ...(dto.date && { date: toUTC(dto.date, timezone) }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      // ✅ 잔액 수정
      await Promise.all([
        tx.account.update({
          where: { id: oldAccount.id },
          data: { balance: restoredOldBalance },
        }),
        tx.account.update({
          where: { id: newAccount.id },
          data: { balance: updatedNewBalance },
        }),
      ]);

      return updatedTransaction;
    });
  }

  async delete(userId: string, id: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundException('삭제할 거래를 찾을 수 없습니다.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: transaction.accountId },
      });

      if (!account) {
        throw new NotFoundException('계좌 정보를 찾을 수 없습니다.');
      }

      const isCard = account.type === 'CARD';

      // ✅ 삭제된 트랜잭션 반영 → 잔액 수정
      const newBalance = (() => {
        if (transaction.type === 'income') {
          return isCard
            ? account.balance - transaction.amount // 카드 계좌: 수입은 부채 감소 → 제거 시 증가
            : account.balance - transaction.amount;
        }

        if (transaction.type === 'expense') {
          return isCard
            ? account.balance + transaction.amount // 카드 계좌: 지출은 부채 증가 → 제거 시 감소
            : account.balance + transaction.amount;
        }

        return account.balance; // transfer는 여기서 처리 안 함
      })();

      await tx.transaction.delete({ where: { id } });

      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      return { success: true };
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

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 출금 및 입금 계좌 조회
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('출금 또는 입금 계좌를 찾을 수 없습니다.');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
      }

      // ✅ 자산 계좌에서 출금 시 잔액 부족 확인
      const isFromCard = fromAccount.type === 'CARD';
      if (!isFromCard && fromAccount.balance < amount) {
        throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
      }

      // ✅ 트랜스퍼 트랜잭션 생성 (출금 + 입금)
      const outTx = await tx.transaction.create({
        data: {
          type: 'transfer',
          amount,
          userId,
          accountId: fromAccountId,
          toAccountId,
          date: toUTC(date, timezone),
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
          date: toUTC(date, timezone),
          note,
          description,
        },
      });

      // ✅ 상호 연결
      await tx.transaction.update({
        where: { id: outTx.id },
        data: { linkedTransferId: inTx.id },
      });

      // ✅ 잔액 계산 로직 (Charles 기준)
      const toIsCard = toAccount.type === 'CARD';

      const newFromBalance = isFromCard
        ? fromAccount.balance // 카드 출금은 잔액 변동 없음
        : fromAccount.balance - amount;

      const newToBalance = toIsCard
        ? toAccount.balance + amount // 카드 입금 = 부채 감소
        : toAccount.balance + amount;

      // ✅ 계좌 잔액 업데이트 (병렬 처리)
      await Promise.all([
        tx.account.update({
          where: { id: fromAccountId },
          data: { balance: newFromBalance },
        }),
        tx.account.update({
          where: { id: toAccountId },
          data: { balance: newToBalance },
        }),
      ]);

      return { outgoing: outTx, incoming: inTx };
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
      // ✅ 계좌 조회
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('출금 또는 입금 계좌를 찾을 수 없습니다.');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
      }

      const fromIsCard = fromAccount.type === 'CARD';
      const toIsCard = toAccount.type === 'CARD';

      // ✅ 자산 계좌는 잔액 체크 필요
      if (!fromIsCard) {
        const simulated = fromAccount.balance + original.amount - amount;
        if (simulated < 0) {
          throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
        }
      }

      // ✅ 기존 linkedTransfer 삭제
      if (original.type === 'transfer' && original.linkedTransferId) {
        await tx.transaction.delete({
          where: { id: original.linkedTransferId },
        });
      }

      // ✅ 새로운 입금 트랜잭션 생성
      const incoming = await tx.transaction.create({
        data: {
          type: 'transfer',
          userId,
          amount,
          accountId: toAccountId,
          toAccountId: null,
          linkedTransferId: original.id,
          date: toUTC(date, timezone),
          note,
          description,
        },
      });

      // ✅ 기존 출금 트랜잭션 수정
      const outgoing = await tx.transaction.update({
        where: { id },
        data: {
          type: 'transfer',
          amount,
          accountId: fromAccountId,
          toAccountId,
          linkedTransferId: incoming.id,
          date: toUTC(date, timezone),
          note,
          description,
          categoryId: null, // ✅ 안전 초기화
        },
      });

      // ✅ 잔액 수정 (기존 → 롤백 후 → 새로운 반영)
      const newFromBalance = fromIsCard
        ? fromAccount.balance - original.amount + amount
        : fromAccount.balance + original.amount - amount;

      const newToBalance = toIsCard
        ? toAccount.balance + original.amount - amount
        : toAccount.balance - original.amount + amount;

      await Promise.all([
        tx.account.update({
          where: { id: fromAccountId },
          data: { balance: newFromBalance },
        }),
        tx.account.update({
          where: { id: toAccountId },
          data: { balance: newToBalance },
        }),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });
  }

  async deleteTransfer(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // ✅ 원본(출금) 트랜잭션 조회
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

    // ✅ 연결된 입금 트랜잭션 조회
    const incoming = await this.prisma.transaction.findUnique({
      where: { id: outgoing.linkedTransferId ?? undefined },
      include: { account: true },
    });

    if (!incoming) {
      throw new NotFoundException('연결된 트랜잭션이 없습니다.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 계좌 조회 (잔액 계산용)
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: outgoing.accountId } }),
        tx.account.findUnique({ where: { id: incoming.accountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('계좌 정보를 찾을 수 없습니다.');
      }

      const fromIsCard = fromAccount.type === 'CARD';
      const toIsCard = toAccount.type === 'CARD';

      // ✅ 잔액 복원: 기존 트랜스퍼를 "되돌리기"
      const newFromBalance = fromIsCard
        ? fromAccount.balance + outgoing.amount
        : fromAccount.balance + outgoing.amount;

      const newToBalance = toIsCard
        ? toAccount.balance - incoming.amount
        : toAccount.balance - incoming.amount;

      // ✅ 트랜잭션 삭제
      await tx.transaction.deleteMany({
        where: {
          id: { in: [outgoing.id, incoming.id] },
        },
      });

      // ✅ 잔액 수정 (되돌리기)
      await Promise.all([
        tx.account.update({
          where: { id: fromAccount.id },
          data: { balance: newFromBalance },
        }),
        tx.account.update({
          where: { id: toAccount.id },
          data: { balance: newToBalance },
        }),
      ]);

      return { success: true };
    });
  }

  private async recalculateAccountBalance(accountId: string): Promise<number> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true },
    });

    if (!account) throw new Error('Account not found');

    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId,
        // deletedAt: null,
        type: { in: ['income', 'expense'] }, // ✅ transfer 제외
      },
      select: {
        amount: true,
        type: true,
      },
    });

    const balance = transactions.reduce((sum, t) => {
      if (account.type === 'CARD') {
        return t.type === 'expense'
          ? sum + Number(t.amount) // 부채 증가
          : sum - Number(t.amount); // 수입이면 부채 감소
      } else {
        return t.type === 'income'
          ? sum + Number(t.amount)
          : sum - Number(t.amount);
      }
    }, 0);

    await this.prisma.account.update({
      where: { id: accountId },
      data: { balance },
    });

    return balance;
  }

  // 공통 로직
  private updateCardBalance(
    current: number,
    amount: number,
    isCard: boolean,
    isFrom: boolean,
  ): number {
    if (isCard) {
      // 카드 계좌: 출금이면 부채 증가, 입금이면 부채 감소
      return isFrom ? current + amount : current - amount;
    } else {
      // 일반 계좌: 출금이면 자산 감소, 입금이면 자산 증가
      return isFrom ? current - amount : current + amount;
    }
  }
}
