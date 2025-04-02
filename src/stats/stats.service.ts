import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, startOfDay } from 'date-fns';
import { StatsQuery } from './dto/stats-query.dto';
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

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        type,
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

    const result: StatsByCategory[] = transactions
      .map((tx): StatsByCategory | null => {
        const matched = budgetCategories.find(
          (bc) => bc.categoryId === tx.categoryId,
        );

        // 매칭 안된 항목은 스킵
        if (!matched || !matched.category) return null;

        const spent = tx._sum.amount ?? 0;
        const budget = matched.amount ?? 0;
        const remaining = budget - spent;

        return {
          categoryId: tx.categoryId!,
          categoryName: matched.category.name,
          categoryType: matched.category.type,
          color: matched.category.color ?? '#999999',
          spent,
          budget,
          remaining,
          rate: budget > 0 ? Math.min((spent / budget) * 100, 999) : 0,
        };
      })
      .filter((item): item is StatsByCategory => item !== null); // 타입 좁히기

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

    // ✅ 2. 트랜잭션 합계 groupBy(categoryId)
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

    // ✅ 3. 예산 + 카테고리 정보 가져오기
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

    // ✅ 4. 각 항목 매핑
    const data: StatsByBudget[] = transactions
      .map((tx): StatsByBudget | null => {
        const matched = budgetCategories.find(
          (bc) => bc.categoryId === tx.categoryId,
        );

        if (!matched || !matched.category) return null;

        const spent = tx._sum?.amount ?? 0;
        const budget = matched.amount ?? 0;
        const remaining = budget - spent;

        return {
          categoryId: tx.categoryId!,
          categoryName: matched.category.name,
          categoryType: matched.category.type,
          icon: matched.category.icon,
          color: matched.category.color ?? '#999999',
          budget,
          spent,
          remaining,
          rate: budget > 0 ? Math.min((spent / budget) * 100, 999) : 0,
        };
      })
      .filter((item): item is StatsByBudget => item !== null); // ✅ 타입 좁히기

    // ✅ 5. 합계 계산
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

  async getByNote(userId: string, query: StatsQuery): Promise<StatsByNoteDTO> {
    const { type, startDate, endDate } = query;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        type, // ✅ 이제 항상 'income' 또는 'expense'만 오니까 안전하게 직접 넣어도 됨
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
      if (tx.type === 'expense') totalExpense += tx.amount;
    });

    return {
      data: Object.values(resultMap),
      totalIncome,
      totalExpense,
    };
  }
}
