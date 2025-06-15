// analysis.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getUserTimezone } from '@/libs/timezone';
import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';
import { TransactionGroupSummaryDTO } from './dto/summary/transaction-group-summary.dto';
import { getPreviousPeriod } from '@/libs/date.util';
import { DateRangeService } from './date-range.service';
import { Prisma, Transaction } from '@prisma/client';
import { addMonths, format, isAfter, startOfMonth } from 'date-fns';
import { TransactionGroupListResponseDTO } from './dto/transactions/transaction-group-list-response.dto';
import { TransactionItemDTO } from './dto/transactions/transaction-item.dto';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { TransactionGroupItemDTO } from './dto/transactions/transaction-group-item.dto';
import { TransactionChartFlowDTO } from './dto/charts/transaction-chart-flow.dto';
import {
  CategoryComparisonDTO,
  CategorySpendingDTO,
  TransactionChartCategoryDTO,
} from './dto/charts/transaction-chart-category.dto';
import { TransactionChartAccountDTO } from './dto/charts/transaction-chart-account.dto';
import {
  BudgetUsageDTO,
  TransactionChartBudgetDTO,
} from './dto/charts/transaction-chart-budget.dto';
import { TransactionCalendarDTO } from './dto/transactions/transaction-calendar.dto';
import { convertToTransactionItemDTO } from './utils/transaction.mapper';

@Injectable()
export class TransactionsAnalysisService {
  constructor(
    private prisma: PrismaService,
    private dateRangeService: DateRangeService,
  ) {}

  private async getUserAndTimezone(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');
    return { user, timezone: getUserTimezone(user) ?? 'UTC' };
  }

  private buildTransactionWhereClause(
    userId: string,
    query: TransactionGroupQueryDTO,
    start: Date,
    end: Date,
  ): Prisma.TransactionWhereInput {
    return {
      userId,
      date: { gte: start, lte: end },
      deletedAt: null,
      ...(query.transactionType && { type: query.transactionType }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.accountId && {
        OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }],
      }),
      ...(query.note?.trim() && {
        note: { contains: query.note.trim(), mode: 'insensitive' },
      }),
    };
  }

  private async groupByField(
    fieldName: 'category' | 'account' | 'date',
    labelSelector: (
      tx: Transaction & {
        account: { name: string };
        category?: { name: string } | null;
      },
    ) => string,
    query: TransactionGroupQueryDTO,
    where: Prisma.TransactionWhereInput,
    timezone: string,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    const allTx = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, TransactionItemDTO[]>();
    for (const tx of allTx) {
      const label = labelSelector(tx);
      if (!grouped.has(label)) grouped.set(label, []);
      grouped
        .get(label)!
        .push(convertToTransactionItemDTO(tx, balanceMap?.get(tx.id)));
    }

    const groups: TransactionGroupItemDTO[] = [...grouped.entries()].map(
      ([label, transactions]) => ({
        groupBy: fieldName,
        groupKey: label,
        totalAmount: transactions.reduce((sum, tx) => sum + tx.amount, 0),
        transactions,
      }),
    );

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate,
      groupBy: fieldName,
      groups,
    };
  }

  async groupByDate(
    query: TransactionGroupQueryDTO,
    timezone: string,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    return this.groupByField(
      'date',
      (tx) => formatInTimeZone(tx.date, timezone, 'yyyy-MM-dd'),
      query,
      where,
      timezone,
      balanceMap,
    );
  }

  async groupByCategory(
    query: TransactionGroupQueryDTO,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    return this.groupByField(
      'category',
      (tx) => tx.category?.name ?? 'Uncategorized',
      query,
      where,
      'UTC', // timezone not used in this label function
      balanceMap,
    );
  }

  async groupByAccount(
    query: TransactionGroupQueryDTO,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    return this.groupByField(
      'account',
      (tx) => tx.account?.name ?? 'Unknown Account',
      query,
      where,
      'UTC',
      balanceMap,
    );
  }

  async getRecommendedKeywords(
    userId: string,
    limit = 5,
    sampleSize = 100,
  ): Promise<string[]> {
    const recent = await this.prisma.transaction.findMany({
      where: { userId, note: { not: null }, deletedAt: null },
      select: { note: true },
      orderBy: { date: 'desc' },
      take: sampleSize,
    });

    const freq: Record<string, number> = {};
    for (const { note } of recent) {
      note!
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '') // 특수문자 제거(유니코드 지원)
        .split(/\s+/)
        .forEach((w) => {
          if (w.length < 3) return; // 3자 미만 제외
          freq[w] = (freq[w] ?? 0) + 1;
        });
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  async getTransactionSummary(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionGroupSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const whereClause: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: start, lte: end },
      deletedAt: null,
      ...(query.transactionType && { type: query.transactionType }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.accountId && {
        OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }],
      }),
      ...(query.note?.trim() && {
        note: {
          contains: query.note.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const allTx = await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const transactions = allTx.filter((tx) =>
      tx.type === 'transfer' ? tx.toAccountId !== null : true,
    );

    const totalIncome = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpense = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const netBalance = totalIncome - totalExpense;

    type TopSpendingItem = {
      id: string;
      name: string;
      icon?: string;
      amount: number;
    };

    const groupMap = new Map<string, TopSpendingItem>();

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;

      let key = '';
      let name = '';
      let icon: string | undefined;

      if (query.groupBy === 'category' && tx.category) {
        key = tx.category.id;
        name = tx.category.name;
        icon = tx.category.icon;
      } else if (query.groupBy === 'account' && tx.account) {
        key = tx.account.id;
        name = tx.account.name;
      } else if (query.groupBy === 'date') {
        key = format(tx.date, 'yyyy-MM-dd');
        name = key;
      } else {
        continue;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { id: key, name, icon, amount: 0 });
      }

      groupMap.get(key)!.amount += tx.amount;
    }

    const topSpending = [...groupMap.values()].sort(
      (a, b) => b.amount - a.amount,
    )[0];

    let comparison: { difference: number; percent: string } | undefined =
      undefined;

    if (query.timeframe !== 'custom' && query.timeframe !== 'all') {
      const prevRange = getPreviousPeriod(query.timeframe, start, end);

      const prevTx = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: prevRange.start, lte: prevRange.end },
          type: 'expense',
          ...(query.categoryId && { categoryId: query.categoryId }),
          ...(query.accountId && {
            OR: [
              { accountId: query.accountId },
              { toAccountId: query.accountId },
            ],
          }),
          ...(query.note?.trim() && {
            note: {
              contains: query.note.trim(),
              mode: 'insensitive',
            },
          }),
          deletedAt: null,
        },
      });

      const prevTotal = prevTx.reduce((sum, tx) => sum + tx.amount, 0);
      const difference = totalExpense - prevTotal;
      const percent = prevTotal
        ? ((difference / prevTotal) * 100).toFixed(1)
        : '0.0';
      comparison = { difference, percent };
    }

    return {
      totalIncome,
      totalExpense,
      netBalance,
      timeframe: query.timeframe,
      groupBy: query.groupBy,
      startDate: query.startDate,
      endDate: query.endDate,
      ...(comparison ? { comparison } : {}),
      ...(topSpending
        ? {
            topSpendingCategory: {
              categoryId: topSpending.id,
              name: topSpending.name,
              icon: topSpending.icon ?? '',
              amount: topSpending.amount,
              type: 'expense',
            },
          }
        : {}),
    };
  }

  async getGroupedTransactions(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionGroupListResponseDTO> {
    const { user, timezone } = await this.getUserAndTimezone(userId);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const baseWhere = this.buildTransactionWhereClause(
      userId,
      query,
      start,
      end,
    );

    let balanceMap: Map<string, number> | undefined;
    if (query.includeBalance && query.accountId) {
      const priorTxs = await this.prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { accountId: query.accountId },
            { toAccountId: query.accountId },
          ],
          date: { lt: start },
          deletedAt: null,
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      });

      const initialBalance = priorTxs.reduce((acc, tx) => {
        if (tx.accountId === query.accountId) {
          return acc - tx.amount;
        } else if (tx.toAccountId === query.accountId) {
          return acc + tx.amount;
        }
        return acc;
      }, 0);

      const txs = await this.prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { accountId: query.accountId },
            { toAccountId: query.accountId },
          ],
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        include: { account: true },
      });

      balanceMap = this.accumulateBalanceAfter(txs, initialBalance);
    }

    switch (query.groupBy ?? 'date') {
      case 'date':
        return this.groupByDate(query, timezone, baseWhere, balanceMap);
      case 'category':
        return this.groupByCategory(query, baseWhere, balanceMap);
      case 'account':
        return this.groupByAccount(query, baseWhere, balanceMap);
      default:
        throw new BadRequestException('지원하지 않는 groupBy 값입니다.');
    }
  }

  async getTransactionCalendarView(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionCalendarDTO[]> {
    const { timeframe } = query;

    // 1️⃣ 사용자 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    if (timeframe !== 'monthly') {
      throw new BadRequestException('timeframe should be monthly or weekly');
    }

    const timezone = getUserTimezone(user) ?? 'UTC';
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 2️⃣ Prisma groupBy로 일자 + 타입 단위 집계
    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    // 3️⃣ Local 날짜 기준 재집계
    const map = new Map<string, { income: number; expense: number }>();

    for (const g of grouped) {
      const local = toZonedTime(g.date, timezone);
      const key = format(local, 'yyyy-MM-dd');

      const item = map.get(key) ?? { income: 0, expense: 0 };

      if (g.type === 'income') item.income += g._sum.amount ?? 0;
      if (g.type === 'expense') item.expense += g._sum.amount ?? 0;

      map.set(key, item);
    }

    console.log('## MA', map);
    // 4️⃣ DTO 변환 및 정렬 (선택)
    return Array.from(map.entries())
      .map(([date, value]) => ({
        date,
        income: value.income,
        expense: value.expense,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 날짜순 정렬 (옵션)
  }

  // ----------- CHART ----------- //
  async getChartFlow(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartFlowDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const allTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
        deletedAt: null,
      },
      orderBy: { date: 'asc' },
    });

    // 🔹 Step 1: 집계 대상 기간 구하기
    const getMonthPeriods = (start: Date, end: Date): string[] => {
      const result: string[] = [];
      let current = startOfMonth(start);
      while (!isAfter(current, end)) {
        result.push(format(current, 'yyyy-MM'));
        current = addMonths(current, 1);
      }
      return result;
    };

    const periodsList = getMonthPeriods(start, end);
    const grouped = new Map<string, { income: number; expense: number }>();

    for (const tx of allTx) {
      const zonedDate = toZonedTime(tx.date, timezone);
      const period = format(zonedDate, 'yyyy-MM');

      if (!grouped.has(period)) {
        grouped.set(period, { income: 0, expense: 0 });
      }

      if (tx.type === 'income') grouped.get(period)!.income += tx.amount;
      if (tx.type === 'expense') grouped.get(period)!.expense += tx.amount;
    }

    const periods = periodsList.map((period) => {
      const data = grouped.get(period) ?? { income: 0, expense: 0 };
      const saved = data.income - data.expense;
      const rate =
        data.income > 0 ? Math.round((saved / data.income) * 100) : 0;

      return {
        period,
        income: data.income,
        expense: data.expense,
        saved,
        rate,
      };
    });

    // 🔹 Step 2: 인사이트 생성
    // const rawInsights = this.chartFlowInsightService.generateInsights(periods); // 주입 필요
    // const sorted = rawInsights.sort(
    //   (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
    // );
    // const insights = sorted.slice(0, query.limit ?? 1);

    // 🔹 Step 3: 응답 객체 구성
    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      insights: [],
      periods,
    };
  }

  async getChartCategory(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartCategoryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 현재 기간 트랜잭션
    const currentTx: Prisma.TransactionGetPayload<{
      include: { category: true };
    }>[] = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type: 'expense',
        categoryId: { not: null },
        deletedAt: null,
      },
      include: { category: true },
    });

    const groupByCategory = new Map<string, CategorySpendingDTO>();
    for (const tx of currentTx) {
      const { id, name, icon, type, color } = tx.category!;
      if (!groupByCategory.has(id)) {
        groupByCategory.set(id, {
          categoryId: id,
          name,
          icon,
          type,
          amount: 0,
          color: color ?? undefined,
        });
      }
      groupByCategory.get(id)!.amount += tx.amount;
    }

    const topCategories = [...groupByCategory.values()].sort(
      (a, b) => b.amount - a.amount,
    );

    // 전월 비교
    let comparison: CategoryComparisonDTO | undefined = undefined;

    if (query.timeframe !== 'custom' && query.timeframe !== 'all') {
      const prevTx: Prisma.TransactionGetPayload<{
        include: { category: true };
      }>[] = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
          type: 'expense',
          categoryId: { not: null },
          deletedAt: null,
        },
        include: { category: true },
      });

      // 이전 기간 집계
      const prevMap = new Map<string, number>();
      for (const tx of prevTx) {
        const category = tx.category;

        if (category) {
          const id = category.id;
          const prevAmount = prevMap.get(id) ?? 0;
          prevMap.set(id, prevAmount + tx.amount);
        }
      }

      // 가장 큰 증감률을 가진 카테고리 찾기
      let maxDelta = 0;
      let bestMatch: CategoryComparisonDTO | null = null;

      for (const current of topCategories) {
        const prevAmount = prevMap.get(current.categoryId) ?? 0;
        const delta = current.amount - prevAmount;
        const percent =
          prevAmount > 0 ? ((delta / prevAmount) * 100).toFixed(1) : '∞';

        if (Math.abs(delta) > Math.abs(maxDelta)) {
          maxDelta = delta;
          bestMatch = {
            categoryId: current.categoryId,
            name: current.name,
            current: current.amount,
            previous: prevAmount,
            difference: delta,
            percentChange: percent,
            trend: delta > 0 ? 'increase' : 'decrease',
          };
        }
      }

      if (bestMatch) comparison = bestMatch;
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      topCategories,
      comparison,
    };
  }

  async getChartAccount(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartAccountDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const accounts = await this.prisma.account.findMany({
      where: { userId },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
        deletedAt: null,
      },
    });

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    let totalIncome = 0;
    let totalExpense = 0;
    let totalBalance = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        incomeMap.set(
          tx.accountId,
          (incomeMap.get(tx.accountId) ?? 0) + tx.amount,
        );
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
        expenseMap.set(
          tx.accountId,
          (expenseMap.get(tx.accountId) ?? 0) + tx.amount,
        );
      }
    }

    const accountsData = accounts
      .map((account) => {
        const income = incomeMap.get(account.id) ?? 0;
        const expense = expenseMap.get(account.id) ?? 0;
        const balance = account.balance;
        totalBalance += balance;

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          income,
          expense,
          balance,
          incomePercent: 0, // 나중에 계산됨
          expensePercent: 0,
          balancePercent: 0,
          color: account.color ?? undefined,
        };
      })
      .sort((a, b) => b.expense - a.expense);

    for (const item of accountsData) {
      item.incomePercent =
        totalIncome > 0 ? Math.round((item.income / totalIncome) * 100) : 0;
      item.expensePercent =
        totalExpense > 0 ? Math.round((item.expense / totalExpense) * 100) : 0;
      item.balancePercent =
        totalBalance > 0 ? Math.round((item.balance / totalBalance) * 100) : 0;
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      accounts: accountsData,
      insights: [], // TODO: 인사이트 연동
    };
  }

  async getChartBudget(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartBudgetDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.dateRangeService.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 1. 예산 카테고리 조회 (기간 & 유저 기준)
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        category: true,
      },
    });

    // 2. 트랜잭션 조회 (해당 기간 expense만)
    const transactions: Prisma.TransactionGetPayload<{
      include: { category: true };
    }>[] = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type: 'expense',
        categoryId: { not: null },
        deletedAt: null,
      },
      include: { category: true },
    });

    // 3. 트랜잭션 집계 (categoryId → used)
    const usedMap = new Map<string, number>();
    for (const tx of transactions) {
      const id = tx.categoryId!;
      usedMap.set(id, (usedMap.get(id) ?? 0) + tx.amount);
    }

    // 4. breakdown 생성
    const seenCategoryIds = new Set<string>();

    const breakdown: BudgetUsageDTO[] = budgetCategories.map((bc) => {
      const used = usedMap.get(bc.categoryId) ?? 0;
      const over = Math.max(0, used - bc.amount);
      const remaining = Math.max(0, bc.amount - used);
      seenCategoryIds.add(bc.categoryId);

      return {
        categoryId: bc.categoryId,
        name: bc.category.name,
        icon: bc.category.icon,
        type: bc.category.type,
        budget: bc.amount,
        used,
        over,
        remaining,
        color: bc.category.color ?? undefined,
      };
    });

    // 5. 미지정 예산 카테고리 처리
    for (const tx of transactions) {
      if (!seenCategoryIds.has(tx.categoryId!)) {
        const id = tx.categoryId!;
        const used = usedMap.get(id)!;

        if (tx.category) {
          breakdown.push({
            categoryId: id,
            name: tx.category.name,
            icon: tx.category.icon,
            type: tx.category.type,
            budget: 0,
            used,
            over: used,
            remaining: 0,
          });
        }
      }
    }

    breakdown.sort((a, b) => b.used - a.used);
    const filteredBreakdown = breakdown.filter((b) => b.budget > 0);
    const totalBudget = breakdown.reduce((sum, b) => sum + b.budget, 0);
    const totalUsed = breakdown.reduce((sum, b) => sum + b.used, 0);
    const usageRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
    const overBudget = totalUsed > totalBudget;
    const overCategoryCount = breakdown.filter((b) => b.over > 0).length;

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      totalBudget,
      totalUsed,
      usageRate: Math.round(usageRate),
      overBudget,
      overCategoryCount,
      breakdown: filteredBreakdown,
    };
  }

  accumulateBalanceAfter(
    transactions: (Transaction & { account: { name: string } })[],
    initialBalance: number,
  ): Map<string, number> {
    const map = new Map<string, number>();
    let balance = initialBalance;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        balance += tx.amount;
      } else if (tx.type === 'expense') {
        balance -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.accountId && tx.toAccountId) {
          balance -= tx.amount;
        }
      }
      map.set(tx.id, balance);
    }
    return map;
  }
}
