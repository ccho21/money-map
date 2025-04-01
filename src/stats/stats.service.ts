import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { CategoryType, StatsQuery } from './dto/stats-query.dto';
import {
  StatsByCategory,
  StatsByCategoryDTO,
} from './dto/stats-by-category.dto';
import { StatsByBudget, StatsByBudgetDTO } from './dto/stats-by-budget.dto';
import { StatsByNote, StatsByNoteDTO } from './dto/stats-by-note.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<StatsByCategoryDTO> {
    const { startDate, endDate, type } = query;
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    this.logger.debug(`📊 getBudgetUsage called with:
    userId: ${userId}
    type: ${type}
    startDate: ${start.toISOString()}
    endDate: ${end.toISOString()}
    `);

    const transactionTypeFilter =
      type === CategoryType.all ? undefined : { type };

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        ...transactionTypeFilter,
      },
      _sum: { amount: true },
    });

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
      },
      include: {
        category: true,
      },
    });

    const result: StatsByCategory[] = transactions.map((tx) => {
      const matched = budgetCategories.find(
        (bc) => bc.categoryId === tx.categoryId,
      );

      const spent = tx._sum.amount ?? 0;
      const budget = matched?.amount ?? 0;
      const remaining = budget - spent;

      return {
        categoryId: tx.categoryId,
        categoryName: matched?.category.name || 'Unknown',
        categoryIcon: matched?.category.icon || '',
        categoryType: matched?.category.type || 'expense',
        color: matched?.category.color as string,
        spent,
        budget,
        remaining,
        rate: budget > 0 ? Math.min((spent / budget) * 100, 999) : 0,
      };
    });

    result.sort((a, b) => b.rate - a.rate);

    const totalIncome = result
      .filter((r) => r.categoryType === 'income')
      .reduce((sum, cur) => sum + cur.spent, 0);

    const totalExpense = result
      .filter((r) => r.categoryType === 'expense')
      .reduce((sum, cur) => sum + cur.spent, 0);

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

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    // ✅ 1. 조건에 따라 type 필터링
    const typeFilter = type === 'all' ? undefined : { type };

    // ✅ 2. 트랜잭션 합계 groupBy(categoryId)
    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        ...(typeFilter ? { type } : {}),
      },
      _sum: {
        amount: true,
      },
    });

    // ✅ 3. 예산 정보 가져오기 (연결된 카테고리 포함)
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: {
          userId,
        },
      },
      include: {
        category: true,
      },
    });

    // ✅ 4. 카테고리별 매핑 + 합산 계산
    const data: StatsByBudget[] = transactions.map((tx) => {
      const matched = budgetCategories.find(
        (bc) => bc.categoryId === tx.categoryId,
      );
      const spent = tx._sum.amount ?? 0;
      const budget = matched?.amount ?? 0;
      const rate = budget > 0 ? Math.min((spent / budget) * 100, 999) : 0;

      return {
        categoryId: tx.categoryId,
        categoryName: matched?.category.name || 'Unknown',
        categoryType: matched?.category.type || 'expense',
        icon: matched?.category.icon || '',
        color: matched?.category.color as string,
        budget,
        spent,
        rate,
        remaining: budget - spent,
      };
    });

    // ✅ 5. 총계 계산
    const totalBudget = data.reduce((acc, item) => acc + item.budget, 0);
    const totalSpent = data.reduce((acc, item) => acc + item.spent, 0);
    const totalRemaining = totalBudget - totalSpent;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      data,
    };
  }

  async getByNote(
    userId: string,
    query: StatsQuery,
  ): Promise<StatsByNoteDTO> {
    const { type, startDate, endDate } = query;

    const baseWhere: any = {
      userId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (type !== CategoryType.all) {
      baseWhere.type = type;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: baseWhere,
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
      if (tx.type === 'expense') totalExpense += tx.amount;
    });

    return {
      data: Object.values(resultMap),
      totalIncome,
      totalExpense,
    };
  }
}
