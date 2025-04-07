import {
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
import { getUTCStartDate } from '@/libs/date.util';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<StatsByCategoryDTO> {
    const { startDate, endDate, type } = query;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

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
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const totalSpent = grouped.reduce(
      (sum, g) => sum + (g._sum.amount ?? 0),
      0,
    );

    let totalIncome = 0;
    let totalExpense = 0;

    const result: StatsByCategory[] = grouped.map((group) => {
      const category = categoryMap.get(group.categoryId!);
      const amount = group._sum.amount ?? 0;
      const rate =
        type === 'expense' && totalSpent > 0
          ? Math.min((amount / totalSpent) * 100, 999)
          : 0;

      if (category?.type === 'income') totalIncome += amount;
      if (category?.type === 'expense') totalExpense += amount;

      return {
        categoryId: group.categoryId!,
        categoryName: category?.name || 'Unknown',
        categoryType: category?.type || 'expense',
        color: category?.color ?? '#999999',
        expense: amount,
        rate,
      };
    });

    result.sort((a, b) => b.expense - a.expense);

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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

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

      if (!matched || !matched.category) continue;

      const spent = tx._sum?.amount ?? 0;
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
      });
    }

    const totalBudget = data.reduce((acc, item) => acc + item.budget, 0);
    const totalSpent = data.reduce((acc, item) => acc + item.spent, 0);

    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
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
}
