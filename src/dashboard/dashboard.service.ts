// src/modules/dashboard/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import {
  DashboardBudgetComparisonDTO,
  DashboardDTO,
  DashboardMonthlyComparisonDTO,
} from './dto/dashboard.dto';
import { startOfDay, subDays } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { InsightService } from '@/insights/insights.service';
import { TransactionGroupQueryDTO } from '@/transactions/dto/params/transaction-group-query.dto';
import { getUserTimezone } from '@/libs/timezone';
import {
  getPreviousPeriod,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { InsightQueryDTO } from '@/insights/dto/query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightService: InsightService,
  ) {}

  async getDashboard(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<DashboardDTO> {
    console.log('### user id', userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(query.startDate, timezone);
    const end = getUTCEndDate(query.endDate ?? query.startDate, timezone);

    const accounts = await this.prisma.account.findMany({ where: { userId } });
    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    const budgetTotal = budgetCategories.reduce((sum, b) => sum + b.amount, 0);

    const expenseTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type: 'expense',
      },
    });
    const usedTotal = expenseTx.reduce((sum, tx) => sum + tx.amount, 0);
    const usageRate = budgetTotal > 0 ? (usedTotal / budgetTotal) * 100 : 0;

    let budgetComparison: DashboardBudgetComparisonDTO | undefined = undefined;
    let monthlyComparison: DashboardMonthlyComparisonDTO | undefined =
      undefined;

    if (query.timeframe !== 'custom') {
      const { start: prevStart, end: prevEnd } = getPreviousPeriod(
        query.timeframe,
        start,
        end,
      );

      const prevExpense = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: prevStart, lte: prevEnd },
          type: 'expense',
        },
      });
      const prevUsed = prevExpense.reduce((sum, tx) => sum + tx.amount, 0);
      const prevUsageRate =
        budgetTotal > 0 ? (prevUsed / budgetTotal) * 100 : 0;
      const usageDiff = usageRate - prevUsageRate;
      const spendingDiff = usedTotal - prevUsed;

      const trend: 'increase' | 'decrease' =
        spendingDiff > 0 ? 'increase' : 'decrease';

      budgetComparison = {
        previousUsageRate: Math.round(prevUsageRate),
        difference: Math.round(usageDiff),
        percentChange: `${Math.abs(usageDiff).toFixed(1)}%`,
        trend,
      };

      monthlyComparison = {
        previousAmount: prevUsed,
        difference: spendingDiff,
        percentChange: `${Math.abs((spendingDiff / (prevUsed || 1)) * 100).toFixed(1)}%`,
        trend,
      };
    }

    const monthlyTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: { gte: start, lte: end },
      },
      include: { category: true },
    });

    const totalMonthly = monthlyTx.reduce((sum, tx) => sum + tx.amount, 0);
    const categoryMap = new Map<
      string,
      { name: string; amount: number; color?: string }
    >();
    for (const tx of monthlyTx) {
      const catId = tx.categoryId ?? 'uncategorized';
      const name = tx.category?.name ?? 'Other';
      categoryMap.set(catId, {
        name,
        amount: (categoryMap.get(catId)?.amount ?? 0) + tx.amount,
        ...(tx.category?.color && { color: tx.category.color }),
      });
    }

    const categoryMonthly = Array.from(categoryMap.entries()).map(
      ([id, data]) => ({
        categoryId: id,
        name: data.name,
        color: data.color,
        percent:
          totalMonthly > 0 ? Math.round((data.amount / totalMonthly) * 100) : 0,
      }),
    );

    const chartTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
      },
      orderBy: { date: 'asc' },
    });

    const insightQuery: InsightQueryDTO = {
      startDate: query.startDate,
      endDate: query.endDate,
      timeframe: query.timeframe,
    };
    const insights = await this.insightService.generateInsights(
      userId,
      ['dashboard'],
      insightQuery,
    );

    return {
      balance,
      budget: {
        used: usedTotal,
        total: budgetTotal,
        usageRate: Math.round(usageRate),
        comparison: budgetComparison,
      },
      monthlySpending: {
        amount: usedTotal,
        comparison: monthlyComparison,
      },
      categoryMonthly,
      insights,
    };
  }
}
