import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Prisma } from '@prisma/client';
import {
  TransactionCalendarItem,
  TransactionDto,
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
import {
  DateQueryDto,
  FindTransactionQueryDto,
  SummaryRangeQueryDto,
} from './dto/filter-transaction.dto';
import { User } from '@prisma/client';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

export type TransactionFilterWhereInput = Prisma.TransactionWhereInput;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  private getUserTimezone(user: User): string {
    return user.timezone || 'America/Toronto';
  }

  async create(userId: string, dto: CreateTransactionDto) {
    console.log('###', dto);
    const transaction = await this.prisma.transaction.create({
      data: {
        ...dto,
        userId,
        date: new Date(dto.date),
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
  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    // 1. 기존 거래 찾기 + 소유자 확인
    const existing = await this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('거래를 찾을 수 없습니다.');
    }

    // 2. 업데이트할 데이터 구성 (불필요한 null/undefined 방지)
    const { type, amount, categoryId, accountId, date, note, description } =
      dto;

    const updateData: Partial<typeof existing> = {};

    if (type) updateData.type = type;
    if (amount !== undefined) updateData.amount = amount;
    if (categoryId) updateData.categoryId = categoryId;
    if (accountId) updateData.accountId = accountId;
    if (date) updateData.date = new Date(date);
    if (note !== undefined) updateData.note = note;
    if (description !== undefined) updateData.description = description;

    // 3. 업데이트 실행
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async getTransactionById(userId: string, transactionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true, account: true },
    });

    if (!transaction) throw new NotFoundException('Account not found');
    if (transaction.userId !== userId)
      throw new ForbiddenException('Access denied');

    return transaction;
  }

  async findFiltered(
    userId: string,
    filter: FindTransactionQueryDto,
  ): Promise<TransactionDto[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const where: TransactionFilterWhereInput = { userId };

    if (filter.type) where.type = filter.type;
    if (filter.categoryId) where.categoryId = filter.categoryId;

    if (filter.startDate && !filter.endDate) {
      where.date = {
        gte: new Date(`${filter.startDate}T00:00:00.000Z`),
        lte: new Date(`${filter.startDate}T23:59:59.999Z`),
      };
    } else if (filter.startDate || filter.endDate) {
      where.date = {};
      if (filter.startDate)
        where.date.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
      if (filter.endDate)
        where.date.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    }

    if (filter.search) {
      where.note = { contains: filter.search, mode: 'insensitive' };
    }

    const sortField = filter.sort ?? 'date';
    const sortOrder = filter.order ?? 'desc';
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
      include: { category: true, account: true },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type as 'income' | 'expense',
      amount: tx.amount,
      note: tx.note ?? '',
      accountId: tx.accountId,
      date: tx.date.toISOString(),
      category: {
        id: tx.category.id,
        name: tx.category.name,
        icon: tx.category.icon,
        type: tx.category.type,
      },
      account: {
        id: tx.account.id,
        name: tx.account.name,
        type: tx.account.type,
        color: tx.account.color,
      },
    }));
  }

  async getTransactionSummary(
    userId: string,
    query: SummaryRangeQueryDto,
  ): Promise<TransactionSummaryDTO> {
    const { groupBy, startDate, endDate } = query;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timeZone = this.getUserTimezone(user);

    // 입력 문자열을 "yyyy-MM-dd" 형식으로 파싱
    const parsedStart = parse(startDate, 'yyyy-MM-dd', new Date());
    const parsedEnd = parse(endDate, 'yyyy-MM-dd', new Date());

    // 사용자의 타임존 기준 날짜로 변환 후, 일의 시작과 끝을 구함
    const startZoned = toZonedTime(parsedStart, timeZone);
    const endZoned = toZonedTime(parsedEnd, timeZone);

    // 사용자 타임존 기준의 시작/끝을 UTC로 변환
    const startUTC = fromZonedTime(startOfDay(startZoned), timeZone);
    const endUTC = fromZonedTime(endOfDay(endZoned), timeZone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startUTC, lte: endUTC },
      },
      orderBy: { date: 'asc' },
      include: { category: true, account: true },
    });

    const grouped = new Map<
      string,
      { rangeStart: string; rangeEnd: string; transactions: TransactionDto[] }
    >();

    for (const tx of transactions) {
      // 거래일자를 사용자의 타임존으로 변환
      const zonedTx = toZonedTime(tx.date, timeZone);
      let label: string;
      let rangeStart: Date;
      let rangeEnd: Date;

      switch (groupBy) {
        case 'daily': {
          rangeStart = startOfDay(zonedTx);
          rangeEnd = endOfDay(zonedTx);
          label = format(rangeStart, 'yyyy-MM-dd');
          break;
        }
        case 'weekly': {
          rangeStart = startOfWeek(zonedTx, { weekStartsOn: 0 });
          rangeEnd = endOfWeek(zonedTx, { weekStartsOn: 0 });
          label = format(rangeStart, 'yyyy-MM-dd');
          break;
        }
        case 'monthly': {
          rangeStart = startOfMonth(zonedTx);
          rangeEnd = endOfMonth(zonedTx);
          label = format(rangeStart, 'yyyy-MM');
          break;
        }
        case 'yearly': {
          rangeStart = startOfYear(zonedTx);
          rangeEnd = endOfYear(zonedTx);
          label = format(rangeStart, 'yyyy');
          break;
        }
        default:
          throw new Error('Invalid groupBy');
      }

      if (!grouped.has(label)) {
        grouped.set(label, {
          rangeStart: format(rangeStart, 'yyyy-MM-dd'),
          rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
          transactions: [],
        });
      }

      grouped.get(label)!.transactions.push({
        id: tx.id,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        note: tx.note ?? '',
        accountId: tx.accountId,
        date: tx.date.toISOString(),
        category: {
          id: tx.category.id,
          name: tx.category.name,
          icon: tx.category.icon,
          type: tx.category.type,
        },
        account: {
          id: tx.account.id,
          name: tx.account.name,
          type: tx.account.type,
          color: tx.account.color,
        },
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
    query: DateQueryDto,
  ): Promise<TransactionCalendarItem[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const timeZone = this.getUserTimezone(user);

    const { year, month } = query;
    const base = new Date(Number(year), Number(month) - 1);
    const startDate = startOfMonth(base);
    const endDate = endOfMonth(base);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const g of grouped) {
      const local = toZonedTime(g.date, timeZone);
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
}
