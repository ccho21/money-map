import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  format,
  subYears,
} from 'date-fns';

@Injectable()
export class AnalysisService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string, range: 'weekly' | 'monthly' | 'yearly') {
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'weekly':
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'yearly':
        startDate = startOfYear(now);
        break;
      case 'monthly':
      default:
        startDate = startOfMonth(now);
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: { gte: startDate },
      },
      include: {
        category: true,
      },
    });

    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    const byCategoryMap = new Map<string, number>();
    const byDateMap = new Map<string, number>();

    for (const tx of transactions) {
      const cat = tx.category.name;
      byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + tx.amount);

      const dateKey = tx.date.toISOString().split('T')[0];
      byDateMap.set(dateKey, (byDateMap.get(dateKey) || 0) + tx.amount);
    }

    const byCategory = Array.from(byCategoryMap.entries()).map(
      ([category, amount]) => ({ category, amount }),
    );

    const byDate = Object.fromEntries(byDateMap);

    const topCategory = byCategory.reduce(
      (max, curr) => (curr.amount > max.amount ? curr : max),
      { category: '', amount: 0 },
    );

    return {
      totalSpent,
      byCategory,
      byDate,
      topCategory,
    };
  }

  async getByCategory(userId: string, categoryId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type: 'expense',
      },
      orderBy: { date: 'asc' },
    });

    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const byDate = Object.fromEntries(
      transactions.map((tx) => [format(tx.date, 'yyyy-MM-dd'), tx.amount]),
    );

    return {
      categoryId,
      totalSpent,
      byDate,
      transactions,
    };
  }

  async getTopSpendingPeriods(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
      },
    });

    const monthlyTotals = new Map<string, number>();

    for (const tx of transactions) {
      const monthKey = format(tx.date, 'yyyy-MM');
      monthlyTotals.set(
        monthKey,
        (monthlyTotals.get(monthKey) || 0) + tx.amount,
      );
    }

    const ranked = Array.from(monthlyTotals.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return ranked;
  }

  async getYoYComparison(userId: string) {
    const now = new Date();
    const thisYear = startOfYear(now);
    const lastYear = startOfYear(subYears(now, 1));

    const [thisYearTx, lastYearTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          date: { gte: thisYear },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          date: { gte: lastYear, lt: thisYear },
        },
      }),
    ]);

    const thisTotal = thisYearTx.reduce((sum, tx) => sum + tx.amount, 0);
    const lastTotal = lastYearTx.reduce((sum, tx) => sum + tx.amount, 0);

    const growth =
      lastTotal === 0 ? null : ((thisTotal - lastTotal) / lastTotal) * 100;

    return {
      thisYear: thisTotal,
      lastYear: lastTotal,
      growthRate: growth !== null ? Number(growth.toFixed(2)) : null,
    };
  }

  async getMoMComparison(userId: string) {
    const now = new Date();
    const thisMonth = startOfMonth(now);
    const lastMonth = startOfMonth(subMonths(now, 1));

    const [thisMonthTx, lastMonthTx] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          date: { gte: thisMonth },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          date: { gte: lastMonth, lt: thisMonth },
        },
      }),
    ]);

    const thisTotal = thisMonthTx.reduce((sum, tx) => sum + tx.amount, 0);
    const lastTotal = lastMonthTx.reduce((sum, tx) => sum + tx.amount, 0);

    const growth =
      lastTotal === 0 ? null : ((thisTotal - lastTotal) / lastTotal) * 100;

    return {
      thisMonth: thisTotal,
      lastMonth: lastTotal,
      growthRate: growth !== null ? Number(growth.toFixed(2)) : null,
    };
  }
}
