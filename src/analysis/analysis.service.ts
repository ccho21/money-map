import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AnalysisService.name);

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

    this.logger.debug(
      `📊 getSummary() → range: ${range}, startDate: ${startDate.toISOString()}, userId: ${userId}`,
    );

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

    this.logger.debug(`🔍 총 거래 수: ${transactions.length}`);

    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    this.logger.debug(`💸 총 지출: ₩${totalSpent}`);

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

    this.logger.debug(
      `🏆 가장 많이 쓴 카테고리: ${topCategory.category}, ₩${topCategory.amount}`,
    );

    return {
      totalSpent,
      byCategory,
      byDate,
      topCategory,
    };
  }

  async getByCategory(userId: string, categoryId: string) {
    this.logger.debug(
      `📊 getByCategory() → userId: ${userId}, categoryId: ${categoryId}`,
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type: 'expense',
      },
      orderBy: { date: 'asc' },
    });

    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    this.logger.debug(
      `💸 총 지출 (카테고리): ₩${totalSpent}, 거래 수: ${transactions.length}`,
    );

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
    this.logger.debug(`📊 getTopSpendingPeriods() → userId: ${userId}`);

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

    this.logger.debug(`🏅 월별 소비 TOP3: ${JSON.stringify(ranked)}`);
    return ranked;
  }

  async getYoYComparison(userId: string) {
    const now = new Date();
    const thisYear = startOfYear(now);
    const lastYear = startOfYear(subYears(now, 1));

    this.logger.debug(`📊 getYoYComparison() → userId: ${userId}`);

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

    this.logger.debug(
      `📈 올해 총지출: ₩${thisTotal}, 작년: ₩${lastTotal}, YoY 증가율: ${growth?.toFixed(2) ?? 'N/A'}%`,
    );

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

    this.logger.debug(`📊 getMoMComparison() → userId: ${userId}`);

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

    this.logger.debug(
      `📉 이번달 총지출: ₩${thisTotal}, 지난달: ₩${lastTotal}, MoM 증가율: ${growth?.toFixed(2) ?? 'N/A'}%`,
    );

    return {
      thisMonth: thisTotal,
      lastMonth: lastTotal,
      growthRate: growth !== null ? Number(growth.toFixed(2)) : null,
    };
  }
}
