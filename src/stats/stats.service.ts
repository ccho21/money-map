import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatsQuery } from './dto/stats-query.dto';
import {
  StatsByCategory,
  StatsByCategoryDTO,
} from './dto/stats-by-category.dto';
import { StatsByBudget, StatsByBudgetDTO } from './dto/stats-by-budget.dto';
import { StatsByNote, StatsByNoteDTO } from './dto/stats-by-note.dto';
import { TransactionSummaryDTO } from '@/transactions/dto/transaction.dto';
import { getUserTimezone } from '@/libs/timezone';
import { groupTransactions } from './util/groupTransactions.util';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import {
  StatsSummaryByCategory,
  StatsSummaryByCategoryDTO,
} from './dto/stats-summary-by-category.dto';
import { toZonedTime } from 'date-fns-tz';
import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import {
  StatsSummaryByBudget,
  StatsSummaryByBudgetDTO,
} from './dto/stats-summary-by-budget.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<StatsByCategoryDTO> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // 1. 거래 집계 (카테고리별 합계)
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        type,
      },
      _sum: { amount: true },
    });

    if (grouped.length === 0) {
      return {
        data: [],
        totalIncome: 0,
        totalExpense: 0,
      };
    }

    const categoryIds = grouped.map((g) => g.categoryId!);

    // 2. 카테고리 정보
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // 3. BudgetCategory
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId: { in: categoryIds },
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

    // 4. 총합 계산
    let totalIncome = 0;
    let totalExpense = 0;

    grouped.forEach((group) => {
      const category = categoryMap.get(group.categoryId!);
      const amount = group._sum.amount ?? 0;
      if (category?.type === 'income') totalIncome += amount;
      if (category?.type === 'expense') totalExpense += amount;
    });

    // 5. 결과 매핑
    const result: StatsByCategory[] = grouped.map((group) => {
      const category = categoryMap.get(group.categoryId!);
      const amount = group._sum.amount ?? 0;
      const budget = budgetMap.get(group.categoryId!);

      const type = category?.type ?? 'expense';
      const total = type === 'income' ? totalIncome : totalExpense;

      const rate = total > 0 ? Math.min((amount / total) * 100, 999) : 0;

      const budgetRate =
        budget && budget.amount > 0
          ? Math.min((amount / budget.amount) * 100, 999)
          : undefined;

      return {
        categoryId: group.categoryId!,
        categoryName: category?.name || 'Unknown',
        categoryType: type,
        color: category?.color ?? '#999999',
        amount,
        rate,
        ...(budget && {
          budgetId: budget.budgetId,
          budget: budget.amount,
          budgetRate,
        }),
      };
    });

    result.sort((a, b) => b.amount - a.amount);

    return {
      data: result,
      totalIncome,
      totalExpense,
    };
  }

  async getByBudget(
    userId: string,
    query: StatsQuery,
  ): Promise<StatsByBudgetDTO> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone); // ⬅︎ endDate 잘못 getUTCStartDate로 되어있던 거 수정

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        type,
      },
      _sum: {
        amount: true,
      },
    });

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
      },
      include: {
        category: true,
      },
    });

    const data: StatsByBudget[] = [];

    for (const tx of transactions) {
      const matched = budgetCategories.find(
        (bc) => bc.categoryId === tx.categoryId,
      );

      const spent = tx._sum?.amount ?? 0;

      if (matched && matched.category) {
        const budget = matched.amount ?? 0;

        data.push({
          categoryId: tx.categoryId!,
          categoryName: matched.category.name,
          categoryType: matched.category.type,
          icon: matched.category.icon,
          color: matched.category.color ?? '#999999',
          budget,
          spent,
          remaining: budget - spent,
          rate: budget > 0 ? Math.min((spent / budget) * 100, 999) : 0,
          hasBudget: true,
        });
      } else {
        const fallback = await this.prisma.category.findUnique({
          where: { id: tx.categoryId! },
        });

        if (fallback) {
          data.push({
            categoryId: tx.categoryId!,
            categoryName: fallback.name,
            categoryType: fallback.type,
            icon: fallback.icon,
            color: fallback.color ?? '#999999',
            spent,
            budget: 0,
            remaining: 0,
            rate: 0,
            hasBudget: false,
          });
        }
      }
    }

    const totalBudget = data
      .filter((item) => item.hasBudget)
      .reduce((acc, item) => acc + item.budget, 0);

    const totalSpent = data
      .filter((item) => item.hasBudget)
      .reduce((acc, item) => acc + item.spent, 0);

    const totalRemaining = totalBudget - totalSpent;

    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      startDate,
      endDate,
      data,
    };
  }

  async getByNote(userId: string, query: StatsQuery): Promise<StatsByNoteDTO> {
    const { type, startDate, endDate } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type,
      },
      select: {
        note: true,
        amount: true,
        type: true,
      },
    });

    const resultMap: Record<string, StatsByNote> = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      const note = tx.note?.trim() || '';
      if (!resultMap[note]) {
        resultMap[note] = { note, count: 0, amount: 0 };
      }
      resultMap[note].count += 1;
      resultMap[note].amount += tx.amount;

      if (tx.type === 'income') totalIncome += tx.amount;
      else totalExpense += tx.amount;
    });

    return {
      data: Object.values(resultMap),
      totalIncome,
      totalExpense,
    };
  }

  async getStatsCategory(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<TransactionSummaryDTO> {
    const { startDate, endDate, groupBy, type } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

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

    const grouped = groupTransactions(transactions, groupBy, timezone);
    const incomeTotal = grouped.reduce((sum, d) => sum + d.incomeTotal, 0);
    const expenseTotal = grouped.reduce((sum, d) => sum + d.expenseTotal, 0);

    return {
      type: groupBy,
      startDate,
      endDate,
      incomeTotal,
      expenseTotal,
      data: grouped,
    };
  }

  async getStatsBudgetCategory(
    userId: string,
    budgetCategoryId: string,
    query: StatsQuery,
  ): Promise<TransactionSummaryDTO> {
    const { startDate, endDate, type, groupBy } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

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
    });

    const grouped = groupTransactions(transactions, groupBy, timezone);
    const incomeTotal = grouped.reduce((sum, d) => sum + d.incomeTotal, 0);
    const expenseTotal = grouped.reduce((sum, d) => sum + d.expenseTotal, 0);

    return {
      type: groupBy,
      startDate,
      endDate,
      incomeTotal,
      expenseTotal,
      data: grouped,
    };
  }

  async getStatsCategorySummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsSummaryByCategoryDTO> {
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
    const end = getUTCStartDate(endDate, timezone);

    // ✅ 1. 구간 생성
    const ranges = getDateRangeList(start, groupBy, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    // ✅ 2. 전체 트랜잭션 미리 가져오기
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

    // ✅ 3. 구간별 매핑을 위한 버킷 생성
    const bucketMap = new Map<string, number>(); // label → amount 합계

    for (const tx of txList) {
      const zoned = toZonedTime(tx.date, timezone);

      const matched = ranges.find((r) => {
        const start = parseISO(r.startDate); // ← string을 date로
        const end = parseISO(r.endDate); // ← string을 date로
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

    // ✅ 4. 응답 데이터 매핑
    let total = 0;
    const data: StatsSummaryByCategory[] = ranges.map((range) => {
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
      categoryId,
      categoryName: category.name,
      data,
      incomeTotal: type === 'income' ? total : 0,
      expenseTotal: type === 'expense' ? total : 0,
    };
  }

  async getStatsBudgetSummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<StatsSummaryByBudgetDTO> {
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
    const end = getUTCStartDate(endDate, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const ranges = getDateRangeList(start, groupBy, timezone);

    // 전체 거래 미리 가져오기
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

    // BudgetCategory 가져오기 (범위 전체 포함되는 예산들)
    const budgetList = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    // 구간별 집계
    const data: StatsSummaryByBudget[] = ranges.map((range) => {
      const rangeStart = parseISO(range.startDate);
      const rangeEnd = parseISO(range.endDate);

      const expenseTotal = txList
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
        budgetAmount !== undefined ? budgetAmount - expenseTotal : undefined;
      const isOver = remaining !== undefined && remaining < 0;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        expenseTotal,
        incomeTotal: 0, // ✅ 타입에 따라 추후 확장 가능
        budgetAmount,
        remaining,
        isOver,
        isCurrent: range.isCurrent, // ✅ 현재 구간 여부
      };
    });

    const totalExpense = data.reduce((sum, d) => sum + d.expenseTotal, 0);
    const totalBudget = data.reduce((sum, d) => sum + (d.budgetAmount ?? 0), 0);
    const totalRemaining = totalBudget - totalExpense;
    const isOver = totalRemaining < 0;

    return {
      categoryId,
      categoryName: category.name,
      color: category.color ?? '#999999',
      totalExpense,
      totalBudget,
      totalRemaining,
      isOver,
      data,
    };
  }
}
