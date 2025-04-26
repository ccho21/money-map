import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { groupTransactions } from './util/groupTransactions.util';
import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getUserTimezone } from '@/libs/timezone';

import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { StatsBudgetGroupItemDTO } from './dto/budget/group-item.dto';
import { StatsCategoryGroupItemDTO } from './dto/category/group-item.dto';
import { StatsNoteGroupItemDTO } from './dto/note/group-item.dto';
import {
  StatsNoteGroupSummaryDTO,
  StatsNoteSummaryDTO,
} from './dto/note/summary.dto';
import { StatsBudgetDetailDTO } from './dto/budget/detail.dto';
import { StatsNoteDetailDTO } from './dto/note/detail.dto';
import { StatsCategoryDetailDTO } from './dto/category/detail.dto';
import {
  StatsCategoryGroupSummaryDTO,
  StatsCategorySummaryDTO,
} from './dto/category/summary.dto';
import {
  StatsBudgetGroupSummaryDTO,
  StatsBudgetSummaryDTO,
} from './dto/budget/summary.dto';
import { StatsQuery } from './dto/stats-query.dto';
import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsCategoryGroupItemDTO>> {
    const { startDate, endDate, type, groupBy } = query;
    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy are required.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const categories = await this.prisma.category.findMany({
      where: { userId, type },
    });

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

    // const budgetCategories = await this.prisma.budgetCategory.findMany({
    //   where: {
    //     categoryId: { in: categories.map((c) => c.id) },
    //     startDate: { lte: end },
    //     endDate: { gte: start },
    //   },
    // });

    // const budgetMap = new Map(
    //   budgetCategories.map((b) => [
    //     b.categoryId,
    //     { budgetId: b.budgetId, amount: b.amount },
    //   ]),
    // );

    let totalExpense = 0;
    let totalIncome = 0;

    const items: StatsCategoryGroupItemDTO[] = categories.map((category) => {
      const amount = amountMap.get(category.id) ?? 0;
      // const budget = budgetMap.get(category.id);
      const rate =
        amountMap.size > 0
          ? Math.min(
              (amount /
                Array.from(amountMap.values()).reduce((sum, a) => sum + a, 0)) *
                100,
              999,
            )
          : 0;
      // const budgetRate =
      //   budget && budget?.amount > 0
      //     ? Math.min((amount / budget.amount) * 100, 999)
      //     : undefined;

      if (category.type === 'expense') totalExpense += amount;
      else totalIncome += amount;

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        color: category.color ?? '#999999',
        amount,
        rate,
        // budgetId: budget?.budgetId,
        // budget: budget?.amount,
        // budgetRate,
        // 👇 BaseGroupItemDTO required fields.
        label: category.name,
        rangeStart: startDate,
        rangeEnd: endDate,
      };
    });

    const summary: StatsCategoryGroupItemDTO = {
      categoryId: 'summary',
      categoryName: 'Summary',
      categoryType: type,
      color: '#3B82F6',
      amount: type === 'expense' ? totalExpense : totalIncome,
      rate: 100,
      // 👇 BaseGroupItemDTO 필수값 추가
      label: 'Summary',
      rangeStart: startDate,
      rangeEnd: endDate,
    };

    return {
      startDate,
      endDate,
      type,
      groupBy,
      items,
      summary,
      totalIncome,
      totalExpense,
    };
  }

  async getByBudget(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsBudgetGroupItemDTO>> {
    const { startDate, endDate, type, groupBy } = query;
    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy are required.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

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

    const txMap = new Map(
      transactions.map((tx) => [tx.categoryId!, tx._sum.amount ?? 0]),
    );
    const budgetMap = new Map(budgetCategories.map((b) => [b.categoryId, b]));

    let totalIncome = 0;
    let totalExpense = 0;

    const items: StatsBudgetGroupItemDTO[] = categories.map((category) => {
      const txAmount = txMap.get(category.id) ?? 0; // transaction amount // expense or income
      const budget = budgetMap.get(category.id);
      const budgetAmount = budget?.amount ?? 0;

      const rate =
        budgetAmount > 0 ? Math.min((txAmount / budgetAmount) * 100, 999) : 0;

      if (category.type === 'expense') totalExpense += txAmount;
      else totalIncome += txAmount;

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        icon: category.icon,
        color: category.color ?? '#999999',
        budgetId: budget?.id,
        amount: txAmount,
        budget: budgetAmount,
        rate,
        hasBudget: !!budget,
        label: category.name,
        rangeStart: startDate,
        rangeEnd: endDate,
      };
    });

    const totalBudget = budgetCategories.reduce((sum, b) => sum + b.amount, 0);

    const summary: StatsBudgetGroupItemDTO = {
      categoryId: '',
      categoryName: '',
      categoryType: type,
      color: '#3B82F6',
      amount: type === 'expense' ? totalExpense : totalIncome,
      budget: totalBudget,
      rate: 0,
      hasBudget: false,
      budgetId: undefined,
      label: groupBy,
      rangeStart: startDate,
      rangeEnd: endDate,
    };

    return {
      startDate,
      endDate,
      groupBy,
      type,
      items,
      summary,
      totalIncome,
      totalExpense,
    };
  }

  async getByNote(
    userId: string,
    query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsNoteGroupItemDTO>> {
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

    // Step 1: transactions를 note별로 그룹핑 + income/expense 집계
    const noteGroups = transactions.reduce((map, tx) => {
      const note = tx.note?.trim() || '';
      if (!map.has(note)) {
        map.set(note, { transactions: [], income: 0, expense: 0 });
      }
      const group = map.get(note)!;
      group.transactions.push(tx);

      if (tx.type === 'income') {
        group.income += tx.amount;
      } else if (tx.type === 'expense') {
        group.expense += tx.amount;
      }
      return map;
    }, new Map<string, { transactions: typeof transactions; income: number; expense: number }>());

    // Step 2: 그룹된 데이터를 기반으로 items 생성
    const items: StatsNoteGroupItemDTO[] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    noteGroups.forEach(({ transactions, income, expense }, note) => {
      const grouped = groupTransactions(transactions, groupBy, timezone);

      grouped.forEach((g) => {
        items.push({
          note,
          type,
          label: g.label,
          count: transactions.length,
          amount: type === 'expense' ? expense : income,
          rangeStart: g.rangeStart,
          rangeEnd: g.rangeEnd,
        });
      });

      totalIncome += income;
      totalExpense += expense;
    });

    const summary: StatsNoteGroupItemDTO = {
      note: 'Summary',
      type,
      label: groupBy,
      amount: type === 'expense' ? totalExpense : totalIncome,
      count: items.reduce((sum, item) => sum + item.count, 0),
      rangeStart: startDate,
      rangeEnd: endDate,
    };

    return {
      startDate,
      endDate,
      groupBy,
      type,
      summary,
      totalIncome,
      totalExpense,
      items,
    };
  }

  async getStatsCategory(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsCategoryDetailDTO> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type are required.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.userId !== userId) {
      throw new NotFoundException('Category not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: { gte: start, lte: end },
      },
      include: {
        account: true,
        category: true,
        // toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = groupTransactions(transactions, groupBy, timezone);

    const totalIncome = grouped.reduce((sum, g) => sum + g.groupIncome, 0);
    const totalExpense = grouped.reduce((sum, g) => sum + g.groupExpense, 0);

    const items: TransactionGroupItemDTO[] = grouped.map((g) => ({
      label: g.label,
      rangeStart: g.rangeStart,
      rangeEnd: g.rangeEnd,
      groupIncome: g.groupIncome,
      groupExpense: g.groupExpense,
      isCurrent: g.isCurrent ?? false,
      transactions: g.transactions,
    }));

    return {
      categoryId: category.id,
      categoryName: category.name,
      icon: category.icon,
      color: category.color ?? '#999999',
      type: category.type,
      totalIncome,
      totalExpense,
      items,
    };
  }

  async getStatsBudget(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsBudgetDetailDTO> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type are required.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const budgetCategory = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId,
        type,
        startDate: { lte: end },
        endDate: { gte: start },
        budget: { userId },
      },
      include: {
        category: true,
      },
    });

    if (!budgetCategory || budgetCategory.category.userId !== userId) {
      throw new NotFoundException('예산 카테고리를 찾을 수 없습니다.');
    }

    const category = budgetCategory.category;
    const budgetAmount = budgetCategory.amount;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: category.id,
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

    const grouped = groupTransactions(transactions, groupBy, timezone);

    const items: TransactionGroupItemDTO[] = grouped.map((g) => {
      return {
        label: g.label,
        rangeStart: g.rangeStart,
        rangeEnd: g.rangeEnd,
        groupIncome: g.groupIncome,
        groupExpense: g.groupExpense,
        isCurrent: g.isCurrent ?? false,
        transactions: g.transactions,
      };
    });

    const totalExpense = items.reduce((sum, d) => sum + d.groupExpense, 0);
    const totalRemaining = items.reduce((sum, d) => sum + d.groupIncome, 0);
    const isOver = totalRemaining < 0;

    return {
      categoryId: category.id,
      categoryName: category.name,
      icon: category.icon,
      color: category.color ?? '#999999',
      type: category.type,
      totalExpense,
      totalBudget: budgetAmount,
      totalRemaining,
      isOver,
      items,
    };
  }

  async getStatsNote(
    userId: string,
    note: string,
    query: StatsQuery,
  ): Promise<StatsNoteDetailDTO> {
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
        note: { equals: note === '_' ? null : note }, //
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = groupTransactions(transactions, groupBy, timezone);

    const totalIncome = grouped.reduce((sum, g) => sum + g.groupIncome, 0);
    const totalExpense = grouped.reduce((sum, g) => sum + g.groupExpense, 0);

    const items: TransactionGroupItemDTO[] = grouped.map((g) => {
      return {
        label: g.label,
        rangeStart: g.rangeStart,
        rangeEnd: g.rangeEnd,
        groupIncome: g.groupIncome,
        groupExpense: g.groupExpense,
        isCurrent: g.isCurrent ?? false,
        transactions: g.transactions,
      };
    });

    return {
      note,
      totalIncome,
      totalExpense,
      items,
    };
  }

  async getStatsCategorySummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsCategorySummaryDTO> {
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
    // const end = parseISO(ranges[ranges.length - 1].endDate);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== userId) {
      throw new NotFoundException('Category not found');
    }

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

    let totalIncome = 0;
    let totalExpense = 0;

    const items: StatsCategoryGroupSummaryDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      const income = type === 'income' ? sum : 0;
      const expense = type === 'expense' ? sum : 0;

      totalIncome += income;
      totalExpense += expense;

      return {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        isCurrent: range.isCurrent,
        income,
        expense,
      };
    });

    return {
      startDate,
      endDate: ranges[ranges.length - 1].endDate,
      groupBy,
      type,
      items,
      totalIncome,
      totalExpense,
    };
  }

  async getStatsBudgetSummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsBudgetSummaryDTO> {
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
    const end = parseISO(ranges[ranges.length - 1].endDate);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== userId) {
      throw new NotFoundException('Category not found');
    }

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

    let totalIncome = 0;
    let totalExpense = 0;

    const items: StatsBudgetGroupSummaryDTO[] = ranges.map((range) => {
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

      if (type === 'expense') totalExpense += total;
      if (type === 'income') totalIncome += total;

      return {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? total : 0,
        expense: type === 'expense' ? total : 0,
        budgetAmount,
        remaining,
        isOver,
      };
    });

    return {
      startDate,
      endDate: ranges[ranges.length - 1].endDate,
      groupBy,
      type,
      items,
      totalIncome,
      totalExpense,
    };
  }

  async getStatsNoteSummary(
    userId: string,
    encodedNote: string,
    query: StatsQuery,
  ): Promise<StatsNoteSummaryDTO> {
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
    // const end = parseISO(ranges[ranges.length - 1].endDate);

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

    let totalIncome = 0;
    let totalExpense = 0;

    const items: StatsNoteGroupSummaryDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      const income = type === 'income' ? sum : 0;
      const expense = type === 'expense' ? sum : 0;

      totalIncome += income;
      totalExpense += expense;

      return {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        isCurrent: range.isCurrent,
        income,
        expense,
      };
    });

    return {
      startDate,
      endDate: ranges[ranges.length - 1].endDate,
      groupBy,
      type,
      items,
      totalIncome,
      totalExpense,
    };
  }
}
