import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { StatsQuery } from './dto/stats-query.dto';
import {
  StatsByCategory,
  StatsByCategoryDTO,
} from './dto/stats-by-category.dto';
import { StatsByBudget, StatsByBudgetDTO } from './dto/stats-by-budget.dto';
import { StatsByNote, StatsByNoteDTO } from './dto/stats-by-note.dto';
import { TransactionSummaryDTO } from '@/transactions/dto/transaction.dto';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getUserTimezone } from '@/common/util/timezone';
import { groupTransactions } from './util/group-transactions';

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

    this.logger.debug(`📊 getByCategory called with:
    userId: ${userId}
    type: ${type}
    startDate: ${start.toISOString()}
    endDate: ${end.toISOString()}
    `);

    // 1. 카테고리별 금액 groupBy
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

    // 2. 관련 카테고리 정보 조회
    const categoryIds = grouped.map((g) => g.categoryId!);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    // 🔄 Map으로 최적화된 접근 구조 생성
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // 3. 최종 데이터 구성 + 전체 합계 집계
    let totalIncome = 0;
    let totalExpense = 0;
    const totalSpent = grouped.reduce(
      (sum, g) => sum + (g._sum.amount ?? 0),
      0,
    );

    const result: StatsByCategory[] = [];

    for (const group of grouped) {
      const category = categoryMap.get(group.categoryId!);
      if (!category) continue;

      const expense = group._sum.amount ?? 0;
      const rate =
        type === 'expense' && totalSpent > 0
          ? Math.min((expense / totalSpent) * 100, 999)
          : 0;

      if (category.type === 'income') totalIncome += expense;
      else if (category.type === 'expense') totalExpense += expense;

      result.push({
        categoryId: group.categoryId!,
        categoryName: category.name,
        categoryType: category.type,
        color: category.color ?? '#999999',
        expense,
        rate,
      });
    }

    // 4. 지출 많은 순으로 정렬
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

  async getStatsCategory(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<TransactionSummaryDTO> {
    const { startDate, endDate, groupBy, type } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    const start = fromZonedTime(
      startOfDay(toZonedTime(parseISO(startDate), timezone)),
      timezone,
    );
    const end = fromZonedTime(
      endOfDay(toZonedTime(parseISO(endDate), timezone)),
      timezone,
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    const data = groupTransactions(transactions, groupBy, timezone);

    const incomeTotal = data.reduce((sum, d) => sum + d.incomeTotal, 0);
    const expenseTotal = data.reduce((sum, d) => sum + d.expenseTotal, 0);
    return {
      type: groupBy.toLowerCase() as 'daily' | 'weekly' | 'monthly' | 'yearly',
      startDate,
      endDate,
      incomeTotal,
      expenseTotal,
      data,
    };
  }

  async getStatsBudgetCategory(
    userId: string,
    budgetCategoryId: string,
    query: StatsQuery,
  ): Promise<TransactionSummaryDTO> {
    const { startDate, endDate, type, groupBy } = query;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    const start = fromZonedTime(
      startOfDay(toZonedTime(parseISO(startDate), timezone)),
      timezone,
    );
    const end = fromZonedTime(
      endOfDay(toZonedTime(parseISO(endDate), timezone)),
      timezone,
    );

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
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      where: {
        userId,
        type,
        categoryId: budgetCategory.categoryId,

        date: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
    });

    const grouped = groupTransactions(transactions, groupBy, timezone); // 유틸 함수 사용

    const incomeTotal = grouped.reduce((sum, d) => sum + d.incomeTotal, 0);
    const expenseTotal = grouped.reduce((sum, d) => sum + d.expenseTotal, 0);

    const summary: TransactionSummaryDTO = {
      type: groupBy.toLowerCase() as 'daily' | 'weekly' | 'monthly' | 'yearly',
      startDate,
      endDate,
      incomeTotal,
      expenseTotal,
      data: grouped,
    };

    return summary;
  }
}
