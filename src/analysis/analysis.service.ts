import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { GetByCategoryDto } from './dto/get-by-category.dto';
import { GetBudgetSummaryDto } from './dto/get-budget-summary.dto';
import { GetNoteSummaryDto } from './dto/get-note-summary.dto';

type BudgetItem = {
  categoryId: string;
  categoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  rate: number;
};

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

    // 🔍 1. 지출 거래 조회
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

    // 🔢 2. 합계 계산
    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    this.logger.debug(`💸 총 지출: ₩${totalSpent}`);

    const byCategoryMap = new Map<string, number>();
    const byDateMap = new Map<string, number>();

    for (const tx of transactions) {
      const cat = tx.category.name;
      byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + tx.amount);

      const dateKey = tx.date.toISOString().split('T')[0]; // YYYY-MM-DD
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

    // 💡 3. 예산 초과 항목 계산
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: {
          userId, // ✅ 이렇게 nested where로 접근
        },
      },
      include: {
        category: true,
      },
    });

    const budgetMap = new Map<string, number>();
    for (const bc of budgetCategories) {
      budgetMap.set(bc.category.name, bc.amount);
    }

    const budgetAlerts = byCategory
      .filter(({ category, amount }) => {
        const budget = budgetMap.get(category);
        return budget !== undefined && amount > budget;
      })
      .map(({ category, amount }) => {
        const budget = budgetMap.get(category)!;
        return {
          category,
          budget,
          spent: amount,
          exceededBy: amount - budget,
        };
      });

    this.logger.debug(`⚠️ 예산 초과 항목 수: ${budgetAlerts.length}`);

    // 📦 최종 응답
    return {
      totalSpent,
      byCategory,
      byDate,
      topCategory,
      budgetAlerts,
    };
  }

  async getCategorySummary(dto: GetByCategoryDto) {
    const { type, year, month } = dto;

    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        type,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const categoryIds = transactions.map((t) => t.categoryId);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    const totalAmount = transactions.reduce(
      (sum, t) => sum + (t._sum.amount || 0),
      0,
    );

    const result = transactions.map((t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      const amount = t._sum.amount || 0;
      return {
        categoryId: t.categoryId,
        categoryName: cat?.name || 'Unknown',
        amount,
        percentage:
          totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      };
    });

    return {
      type,
      totalAmount,
      categories: result,
    };
  }

  async getBudgetSummary(dto: GetBudgetSummaryDto) {
    const { year, month } = dto;

    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    // 전체 예산 (이 달에 유효한 budget)
    const budgets = await this.prisma.budget.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    const categoryIds: string[] = budgets.reduce<string[]>((acc, budget) => {
      for (const bc of budget.categories as { categoryId: string }[]) {
        acc.push(bc.categoryId);
      }
      return acc;
    }, []);

    // 카테고리별 실제 지출 금액
    const expenses = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        type: 'expense',
        categoryId: { in: categoryIds },
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // 카테고리별 지출 매핑
    const expenseMap = new Map<string, number>();
    for (const exp of expenses) {
      if (exp.categoryId) {
        expenseMap.set(exp.categoryId, exp._sum.amount ?? 0);
      }
    }

    const items: BudgetItem[] = budgets.flatMap((budget) =>
      (
        budget.categories as {
          amount: number;
          category: { id: string; name: string };
        }[]
      ).map((bc) => {
        const category = bc.category;
        const spent = expenseMap.get(category.id) ?? 0;
        const remaining = bc.amount - spent;
        const rate = bc.amount > 0 ? Math.round((spent / bc.amount) * 100) : 0;

        return {
          categoryId: category.id,
          categoryName: category.name,
          budget: bc.amount,
          spent,
          remaining,
          rate,
        };
      }),
    );

    const totalBudget: number = items.reduce((sum, i) => sum + i.budget, 0);
    const totalSpent: number = items.reduce((sum, i) => sum + i.spent, 0);
    const totalRemaining = totalBudget - totalSpent;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      items,
    };
  }

  async getNoteSummary(dto: GetNoteSummaryDto) {
    const { year, month } = dto;

    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    // 📌 note가 있는 지출만 groupBy
    const groupedNotes = await this.prisma.transaction.groupBy({
      by: ['note'],
      where: {
        type: 'expense',
        note: { not: null },
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      _count: {
        note: true,
      },
      _sum: {
        amount: true,
      },
    });

    // 📌 결과 형식 변환
    const result = groupedNotes.map((g) => ({
      note: g.note ?? '기타',
      count: g._count.note ?? 0,
      totalAmount: g._sum.amount ?? 0,
    }));

    return result;
  }
}
