import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StatsQuery } from './dto/stats-query.dto';

import { getUserTimezone } from '@/libs/timezone';
import { groupTransactions } from './util/groupTransactions.util';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { toZonedTime } from 'date-fns-tz';
import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoryStatsItemDTO } from './dto/category/group-item.dto';
import { BaseStatsResponseDTO } from './dto/base/base-stats-response.dto';
import { BudgetStatsItemDTO } from './dto/budget/group-item.dto';
import {
  NoteStatsItemDTO,
  NoteSummaryItemNoteDTO,
} from './dto/note/group-item.dto';
import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { BudgetGroupSummaryItemDTO } from './dto/budget/summary.dto';
import { CategoryGroupSummaryItemDTO } from './dto/category/summary.dto';
import { NoteGroupSummaryItemDTO } from './dto/note/summary.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<CategoryStatsItemDTO>> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 전체 카테고리 가져오기
    const categories = await this.prisma.category.findMany({
      where: { userId, type },
    });

    // ✅ 거래 총합 그룹화
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const amountMap = new Map(
      grouped.map((g) => [g.categoryId!, g._sum.amount ?? 0]),
    );

    // ✅ 예산 정보 조회
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId: { in: categories.map((c) => c.id) },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const budgetMap = new Map(
      budgetCategories.map((b) => [
        b.categoryId,
        { budgetId: b.budgetId, amount: b.amount },
      ]),
    );

    // ✅ 총 금액 계산
    const totalAmount = Array.from(amountMap.values()).reduce(
      (sum, amt) => sum + amt,
      0,
    );

    // ✅ 최종 결과 매핑
    const data: CategoryStatsItemDTO[] = categories.map((category) => {
      const amount = amountMap.get(category.id) ?? 0;
      const budget = budgetMap.get(category.id);
      const rate =
        totalAmount > 0 ? Math.min((amount / totalAmount) * 100, 999) : 0;
      const budgetRate =
        budget && budget.amount > 0
          ? Math.min((amount / budget.amount) * 100, 999)
          : undefined;

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color ?? '#999999',
        amount,
        rate,
        ...(budget && {
          budgetId: budget.budgetId,
          budget: budget.amount,
          budgetRate,
        }),
      };
    });

    data.sort((a, b) => b.amount - a.amount);

    return {
      data,
      total: totalAmount,
    };
  }

  async getByBudget(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<BudgetStatsItemDTO>> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const categories = await this.prisma.category.findMany({
      where: { userId, type },
    });

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        categoryId: { in: categories.map((c) => c.id) },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const budgetMap = new Map(budgetCategories.map((b) => [b.categoryId, b]));

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const txMap = new Map(
      transactions.map((tx) => [tx.categoryId!, tx._sum.amount ?? 0]),
    );

    const data: BudgetStatsItemDTO[] = categories.map((category) => {
      const amount = txMap.get(category.id) ?? 0;
      const budget = budgetMap.get(category.id);
      const budgetAmount = budget?.amount ?? 0;

      const spent = category.type === 'expense' ? amount : 0;
      const income = category.type === 'income' ? amount : 0;
      const remaining = category.type === 'expense' ? budgetAmount - spent : 0;
      const rate =
        budgetAmount > 0 ? Math.min((amount / budgetAmount) * 100, 999) : 0;

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color ?? '#999999',
        amount,
        budget: budgetAmount,
        spent,
        income,
        remaining,
        rate,
        hasBudget: !!budget,
      };
    });

    const total = data.reduce((sum, item) => sum + (item.amount ?? 0), 0);

    return {
      data,
      total,
    };
  }

  async getByNote(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<NoteStatsItemDTO>> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        date: { gte: start, lte: end },
      },
      include: {
        account: true,
        category: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    type TxWithRelations = (typeof transactions)[number];
    const noteMap = new Map<string, TxWithRelations[]>();

    for (const tx of transactions) {
      const note = tx.note?.trim() || '';
      if (!noteMap.has(note)) {
        noteMap.set(note, []);
      }
      noteMap.get(note)!.push(tx);
    }

    let total = 0;
    const data: NoteStatsItemDTO[] = [];

    for (const [note, txList] of noteMap.entries()) {
      const grouped = groupTransactions(txList, groupBy, timezone); // TransactionSummary[]
      const incomeSum = grouped.reduce((sum, g) => sum + g.groupIncome, 0);
      const expenseSum = grouped.reduce((sum, g) => sum + g.groupExpense, 0);
      const groupTotal = incomeSum + expenseSum;
      total += groupTotal;

      const summarized: NoteSummaryItemNoteDTO[] = grouped.map(
        (g: TransactionGroupItemDTO) => ({
          label: g.label,
          startDate: g.rangeStart,
          endDate: g.rangeEnd,
          income: g.groupIncome,
          expense: g.groupExpense,
          isCurrent: g.isCurrent ?? false,
        }),
      );

      data.push({
        note,
        type,
        data: summarized,
        count: txList.length,
        totalIncome: incomeSum,
        totalExpense: expenseSum,
      });
    }

    data.sort(
      (a, b) =>
        b.totalIncome + b.totalExpense - (a.totalIncome + a.totalExpense),
    );

    return {
      data,
      total,
    };
  }

  async getStatsCategory(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<TransactionGroupItemDTO>> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped: TransactionGroupItemDTO[] = groupTransactions(
      transactions,
      groupBy,
      timezone,
    );

    const totalIncome = grouped.reduce(
      (sum, d) => sum + d.groupIncome + d.groupExpense,
      0,
    );

    const totalExpense = grouped.reduce(
      (sum, d) => sum + d.groupIncome + d.groupExpense,
      0,
    );

    return {
      groupBy,
      startDate,
      endDate,
      data: grouped,
      totalIncome,
      totalExpense,
    };
  }

  async getStatsNoteDetail(
    userId: string,
    encodedNote: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<TransactionGroupItemDTO>> {
    const { startDate, endDate, type, groupBy } = query;

    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const rawNote = decodeURIComponent(encodedNote).trim();
    const note = rawNote === '_' ? null : rawNote;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        note,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped: TransactionGroupItemDTO[] = groupTransactions(
      transactions,
      groupBy,
      timezone,
    );

    const total = grouped.reduce(
      (sum, d) => sum + d.groupIncome + d.groupExpense,
      0,
    );

    return {
      data: grouped,
      total,
    };
  }

  async getStatsBudgetCategory(
    userId: string,
    budgetCategoryId: string,
    query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<TransactionGroupItemDTO>> {
    const { startDate, endDate, type, groupBy } = query;

    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const budgetCategory = await this.prisma.budgetCategory.findUnique({
      where: { id: budgetCategoryId },
      include: {
        category: true,
        budget: true,
      },
    });

    if (!budgetCategory || budgetCategory.budget.userId !== userId) {
      throw new ForbiddenException('해당 예산 항목에 접근할 수 없습니다.');
    }

    if (budgetCategory.category.type !== type) {
      throw new BadRequestException(
        `카테고리 타입(${budgetCategory.category.type})과 요청 타입(${type})이 일치하지 않습니다.`,
      );
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        categoryId: budgetCategory.categoryId,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped: TransactionGroupItemDTO[] = groupTransactions(
      transactions,
      groupBy,
      timezone,
    );

    const totalIncome = grouped.reduce(
      (sum, d) => sum + d.groupIncome + d.groupExpense,
      0,
    );

    const totalExpense = grouped.reduce(
      (sum, d) => sum + d.groupIncome + d.groupExpense,
      0,
    );

    return {
      groupBy,
      startDate,
      endDate,
      data: grouped,
      totalIncome,
      totalExpense,
    };
  }

  async getStatsCategorySummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<CategoryGroupSummaryItemDTO>> {
    const { startDate, endDate, groupBy } = query;

    if (!startDate || !endDate || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const ranges = getDateRangeList(start, groupBy, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const type = category.type;

    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const bucketMap = new Map<string, number>();

    for (const tx of txList) {
      const zoned = toZonedTime(tx.date, timezone);
      const matched = ranges.find((r) => {
        const start = parseISO(r.startDate);
        const end = parseISO(r.endDate);
        return isWithinInterval(zoned, {
          start: startOfDay(start),
          end: endOfDay(end),
        });
      });
      if (!matched) continue;

      const key = matched.label;
      const current = bucketMap.get(key) ?? 0;
      bucketMap.set(key, current + tx.amount);
    }

    let total = 0;
    const data: CategoryGroupSummaryItemDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      total += sum;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? sum : 0,
        expense: type === 'expense' ? sum : 0,
        total: type === 'income' ? sum : -sum,
      };
    });

    return {
      data,
      total,
    };
  }

  async getStatsBudgetSummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<BudgetGroupSummaryItemDTO>> {
    const { startDate, endDate, groupBy } = query;

    if (!startDate || !endDate || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);
    const ranges = getDateRangeList(start, groupBy, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const type = category.type;

    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const budgetList = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    let totalBudget = 0;
    let totalUsed = 0;

    const data: BudgetGroupSummaryItemDTO[] = ranges.map((range) => {
      const rangeStart = parseISO(range.startDate);
      const rangeEnd = parseISO(range.endDate);

      const total = txList
        .filter((tx) => {
          const zoned = toZonedTime(tx.date, timezone);
          return isWithinInterval(zoned, {
            start: startOfDay(rangeStart),
            end: endOfDay(rangeEnd),
          });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const budget = budgetList.find(
        (b) =>
          isWithinInterval(rangeStart, {
            start: startOfDay(b.startDate),
            end: endOfDay(b.endDate),
          }) ||
          isWithinInterval(rangeEnd, {
            start: startOfDay(b.startDate),
            end: endOfDay(b.endDate),
          }),
      );

      const budgetAmount = budget?.amount;
      const remaining =
        budgetAmount !== undefined ? budgetAmount - total : undefined;
      const isOver = remaining !== undefined && remaining < 0;

      if (budgetAmount !== undefined) totalBudget += budgetAmount;
      totalUsed += total;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? total : 0,
        expense: type === 'expense' ? total : 0,
        budgetAmount,
        remaining,
        isOver,
      };
    });

    // const totalRemaining = totalBudget - totalUsed;

    return {
      data,
      total: totalUsed,
      rate: totalBudget > 0 ? (totalUsed / totalBudget) * 100 : undefined,
    };
  }

  async getStatsNoteSummary(
    userId: string,
    encodedNote: string,
    query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<NoteGroupSummaryItemDTO>> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const ranges = getDateRangeList(start, groupBy, timezone);

    const rawNote = decodeURIComponent(encodedNote).trim();
    const note = rawNote === '_' ? null : rawNote;

    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        note,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const bucketMap = new Map<string, number>();

    for (const tx of txList) {
      const txDate = parseISO(tx.date.toISOString());

      const matched = ranges.find((r) => {
        const start = parseISO(r.startDate);
        const end = parseISO(r.endDate);
        return isWithinInterval(txDate, {
          start: startOfDay(start),
          end: endOfDay(end),
        });
      });

      if (!matched) continue;

      const key = matched.label;
      const current = bucketMap.get(key) ?? 0;
      bucketMap.set(key, current + tx.amount);
    }

    let total = 0;
    const data: NoteGroupSummaryItemDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      total += sum;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? sum : 0,
        expense: type === 'expense' ? sum : 0,
      };
    });

    return {
      data,
      total,
    };
  }
}
