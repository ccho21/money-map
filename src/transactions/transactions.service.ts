import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { Prisma, TransactionType } from '@prisma/client';
import {
  TransactionCalendarItem,
  TransactionDTO,
  TransactionSummary,
  TransactionSummaryDTO,
} from './dto/transaction.dto';

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  startOfDay,
  endOfDay,
  parse,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

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

    const transaction = await this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        categoryId: dto.categoryId,
        accountId: dto.accountId,
        note: dto.note,
        date: toUTC(dto.date, timezone),
        userId,
      },
    });

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new Error('카테고리를 찾을 수 없습니다.');

    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId: dto.categoryId,
        budget: { userId },
      },
    });

    if (budgetItem) {
      const spent = await this.prisma.transaction.aggregate({
        where: { categoryId: dto.categoryId, userId },
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const updateData: TransactionUpdateDTO = {
      ...(dto.type && { type: dto.type }),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.categoryId && { categoryId: dto.categoryId }),
      ...(dto.accountId && { accountId: dto.accountId }),
      ...(dto.date && { date: toUTC(dto.date, timezone).toISOString() }),
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.description !== undefined && { description: dto.description }),
    };

    return this.prisma.transaction.update({
      where: { id },
      data: updateData,
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    const start = getLocalDate(startDate, timezone);
    const end = getLocalDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
      },
      orderBy: { date: 'asc' },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

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
    if (!user) {
      throw new Error('User not found');
    }
    const timezone = getUserTimezone(user);
    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌 간 이체는 허용되지 않습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. 계좌 유효성 확인 및 잔액 조회
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('출금 또는 입금 계좌를 찾을 수 없습니다.');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('본인의 계좌가 아닙니다.');
      }

      if (fromAccount.balance < amount) {
        throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
      }

      // 2. 출금 트랜잭션 생성
      const outgoing = await tx.transaction.create({
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

      // 3. 입금 트랜잭션 생성
      const incoming = await tx.transaction.create({
        data: {
          type: 'transfer',
          amount,
          userId,
          accountId: toAccountId,
          toAccountId: null,
          linkedTransferId: outgoing.id,
          date: toUTC(date, timezone),
          note,
          description,
        },
      });

      // 4. 출금 트랜잭션에 링크 업데이트
      await tx.transaction.update({
        where: { id: outgoing.id },
        data: {
          linkedTransferId: incoming.id,
        },
      });

      // 5. 계좌 잔액 업데이트
      await Promise.all([
        tx.account.update({
          where: { id: fromAccountId },
          data: {
            balance: {
              decrement: amount,
            },
          },
        }),
        tx.account.update({
          where: { id: toAccountId },
          data: {
            balance: {
              increment: amount,
            },
          },
        }),
      ]);

      return { outgoing, incoming };
    });
  }

  async updateTransfer(
    userId: string,
    id: string,
    dto: TransactionTransferDTO,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const timezone = getUserTimezone(user);
    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌로 이체할 수 없습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      const original = await tx.transaction.findUnique({
        where: { id },
        include: { account: true },
      });

      if (!original || original.userId !== userId) {
        throw new NotFoundException('수정할 트랜잭션을 찾을 수 없습니다.');
      }

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

      const prevAmount = original.amount;
      // const prevFromAccountId = original.accountId;

      // 기존 잔액 롤백
      await tx.account.update({
        where: { id: original.accountId },
        data: { balance: { increment: prevAmount } },
      });

      // 케이스 1: 기존 트랜잭션이 transfer였다면 linkedTransfer를 찾아서 삭제
      if (original.type === 'transfer' && original.linkedTransferId) {
        await tx.transaction.delete({
          where: { id: original.linkedTransferId },
        });
        await tx.account.update({
          where: { id: toAccountId },
          data: { balance: { decrement: prevAmount } }, // 기존 입금 롤백
        });
      }

      // 출금 계좌 잔액 확인 (잔액 복구 후 시뮬레이션)
      const fromAccountAfterRollback = await tx.account.findUnique({
        where: { id: fromAccountId },
      });

      if ((fromAccountAfterRollback?.balance ?? 0) < amount) {
        throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
      }

      // 새로운 입금 트랜잭션 생성
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

      // 기존 트랜잭션을 출금용 transfer로 업데이트
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
          categoryId: null, // ✅ 기존 income/expense일 경우 카테고리 제거
        },
      });

      // 새로운 잔액 반영
      await Promise.all([
        tx.account.update({
          where: { id: fromAccountId },
          data: { balance: { decrement: amount } },
        }),
        tx.account.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount } },
        }),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });
  }

  async deleteTransfer(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const outgoing = await tx.transaction.findUnique({
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

      const incoming = await tx.transaction.findUnique({
        where: { id: outgoing.linkedTransferId ?? undefined },
        include: { account: true },
      });

      if (!incoming) {
        throw new NotFoundException('연결된 트랜잭션이 없습니다.');
      }

      // 잔액 복구
      await Promise.all([
        tx.account.update({
          where: { id: outgoing.accountId },
          data: { balance: { increment: outgoing.amount } },
        }),
        tx.account.update({
          where: { id: incoming.accountId },
          data: { balance: { decrement: incoming.amount } },
        }),
      ]);

      // 삭제
      await tx.transaction.deleteMany({
        where: {
          id: { in: [outgoing.id, incoming.id] },
        },
      });

      return { success: true };
    });
  }
}
