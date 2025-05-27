// 📁 src/modules/transaction/data/TransactionDataService.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  differenceInCalendarDays,
} from 'date-fns';
import { TransactionType } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';
import { getUserTimezone } from '@/libs/timezone';
import { getUTCEndDate, getUTCStartDate } from '@/libs/date.util';
import { ChartDataItem } from '@/insights/dto/chart-item.dto';

@Injectable()
export class TransactionDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategorySpendingSummary(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, number>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
  
    const timezone = getUserTimezone(user);
    const utcStart = getUTCStartDate(startDate, timezone);
    const utcEnd = getUTCEndDate(endDate, timezone);
  
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: utcStart,
          lte: utcEnd,
        },
      },
      include: {
        category: true, // include를 써야 category.name 사용 가능
      },
    });
  
    const summary: Record<string, number> = {};
    for (const tx of transactions) {
      const key = tx.category?.name ?? '(Uncategorized)';
      summary[key] = (summary[key] ?? 0) + tx.amount;
    }
  
    return summary;
  }
  

  async getRecentTransactions(
    userId: string,
    days: number,
  ): Promise<{ amount: number; date: Date }[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    // 오늘 날짜 (타임존 기준) → days 전 날짜 계산
    const todayStr = new Date().toISOString().split('T')[0];
    const localTodayStart = getUTCStartDate(todayStr, timezone); // 오늘 타임존 00:00
    const sinceDate = subDays(localTodayStart, days); // 타임존 기준으로 days 전
    const sinceUTC = sinceDate; // 이미 UTC 기준됨

    return await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: sinceUTC,
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });
  }

  async getCategoryMonthlyComparison(
    userId: string,
  ): Promise<Record<string, { current: number; previous: number }>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = new Date();

    // 타임존 기준 현재/이전 달의 시작과 끝 계산
    const startOfCurrentMonthLocal = startOfMonth(fromZonedTime(now, timezone));
    const startOfPreviousMonthLocal = startOfMonth(
      subMonths(startOfCurrentMonthLocal, 1),
    );
    const endOfPreviousMonthLocal = endOfMonth(
      subMonths(startOfCurrentMonthLocal, 1),
    );

    const startUTC = getUTCStartDate(
      this.formatDate(startOfPreviousMonthLocal),
      timezone,
    );
    const endUTC = getUTCEndDate(this.formatDate(now), timezone);

    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: startUTC,
          lte: endUTC,
        },
      },
      select: {
        amount: true,
        date: true,
        categoryId: true,
      },
    });

    const summary: Record<string, { current: number; previous: number }> = {};

    for (const tx of txs) {
      if (!tx.categoryId) continue;

      const localDate = fromZonedTime(tx.date, timezone);
      const isCurrent = localDate >= startOfCurrentMonthLocal;

      const ref = (summary[tx.categoryId] ??= { current: 0, previous: 0 });
      if (isCurrent) ref.current += tx.amount;
      else ref.previous += tx.amount;
    }

    return summary;
  }

  async getMonthlyIncomeExpenseTotals(
    userId: string,
  ): Promise<{ income: number; expense: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = new Date();

    // 1. 타임존 기준 현재 달의 시작/끝 구하기
    const localStart = startOfMonth(fromZonedTime(now, timezone));
    const localEnd = endOfMonth(fromZonedTime(now, timezone));

    // 2. UTC 변환
    const start = getUTCStartDate(
      localStart.toISOString().split('T')[0],
      timezone,
    );
    const end = getUTCEndDate(localEnd.toISOString().split('T')[0], timezone);

    // 3. 집계 쿼리
    const aggregates = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      _sum: {
        amount: true,
      },
    });

    const result = { income: 0, expense: 0 };

    for (const entry of aggregates) {
      if (entry.type === TransactionType.income)
        result.income = entry._sum.amount ?? 0;
      if (entry.type === TransactionType.expense)
        result.expense = entry._sum.amount ?? 0;
    }

    return result;
  }

  async getExpenseTransactionsByDate(
    userId: string,
    days: number,
  ): Promise<{ categoryId: string; date: string; amount: number }[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    // 1. 오늘 기준 타임존 정규화
    const todayLocalStr = new Date().toISOString().split('T')[0];
    const todayStartLocal = fromZonedTime(
      `${todayLocalStr}T00:00:00`,
      timezone,
    );
    const sinceDateLocal = subDays(todayStartLocal, days);
    const sinceUTC = sinceDateLocal; // 이미 fromZonedTime으로 UTC 기준 처리됨

    // 2. 트랜잭션 불러오기
    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: sinceUTC,
        },
      },
      select: {
        categoryId: true,
        date: true,
        amount: true,
      },
    });

    // 3. 날짜 타임존 변환 후 ISO date로 반환
    return txs
      .filter((tx) => tx.categoryId !== null)
      .map((tx) => ({
        categoryId: tx.categoryId!,
        date: fromZonedTime(tx.date, timezone).toISOString().split('T')[0], // 타임존 기준 날짜로 normalization
        amount: tx.amount,
      }));
  }

  async getIncomeTotalsForTwoMonths(
    userId: string,
  ): Promise<{ current: number; previous: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = new Date();

    // 타임존 기준 이번 달/지난 달 구간 계산
    const localNow = fromZonedTime(now, timezone);

    const currentStartLocal = startOfMonth(localNow);
    const currentEndLocal = endOfMonth(localNow);
    const prevStartLocal = startOfMonth(subMonths(localNow, 1));
    const prevEndLocal = endOfMonth(subMonths(localNow, 1));

    // UTC 변환
    const queryStart = getUTCStartDate(
      prevStartLocal.toISOString().split('T')[0],
      timezone,
    );
    const queryEnd = getUTCEndDate(
      currentEndLocal.toISOString().split('T')[0],
      timezone,
    );

    // 쿼리: 지난달~이번달까지 모든 income 트랜잭션
    const result = await this.prisma.transaction.groupBy({
      by: ['date'],
      where: {
        userId,
        type: TransactionType.income,
        date: { gte: queryStart, lte: queryEnd },
      },
      _sum: {
        amount: true,
      },
    });

    let current = 0;
    let previous = 0;

    for (const r of result) {
      const localDate = fromZonedTime(r.date, timezone);
      const amt = r._sum.amount ?? 0;

      if (localDate >= currentStartLocal && localDate <= currentEndLocal) {
        current += amt;
      } else if (localDate >= prevStartLocal && localDate <= prevEndLocal) {
        previous += amt;
      }
    }

    return { current, previous };
  }

  async getExpenseBreakdownByAccountType(
    userId: string,
  ): Promise<{ total: number; card: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = new Date();
    const localNow = fromZonedTime(now, timezone);

    // 타임존 기준 월 시작/종료 계산
    const localStart = startOfMonth(localNow);
    const localEnd = endOfMonth(localNow);

    const start = getUTCStartDate(
      localStart.toISOString().split('T')[0],
      timezone,
    );
    const end = getUTCEndDate(localEnd.toISOString().split('T')[0], timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: { gte: start, lte: end },
      },
      select: {
        amount: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    });

    let total = 0;
    let card = 0;

    for (const tx of transactions) {
      total += tx.amount;
      if (tx.account.type === 'CARD') {
        card += tx.amount;
      }
    }

    return { total, card };
  }

  async getSpendingByTime(
    startDate: string,
    endDate: string,
    userId: string,
  ): Promise<ChartDataItem> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: start,
          lte: end,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    const bucketMap: Record<string, number> = {
      '00–06': 0,
      '06–12': 0,
      '12–18': 0,
      '18–24': 0,
    };

    for (const tx of transactions) {
      const localTime = fromZonedTime(tx.createdAt, timezone);
      const hour = localTime.getHours();
      const amt = tx.amount ?? 0;

      if (hour < 6) bucketMap['00–06'] += amt;
      else if (hour < 12) bucketMap['06–12'] += amt;
      else if (hour < 18) bucketMap['12–18'] += amt;
      else bucketMap['18–24'] += amt;
    }

    return this.toChartDataItem(bucketMap);
  }

  async getSpendingByDay(
    startDate: string,
    endDate: string,
    userId: string,
  ): Promise<ChartDataItem> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const result = await this.prisma.transaction.groupBy({
      by: ['date'],
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const dayMap: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    result.forEach((row) => {
      const localDate = fromZonedTime(new Date(row.date), timezone);
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
        localDate.getDay()
      ];
      dayMap[day] += row._sum.amount ?? 0;
    });

    return this.toChartDataItem(dayMap);
  }

  async getSpendingByWeek(
    startDate: string,
    endDate: string,
    userId: string,
  ): Promise<Record<string, number>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    const utcStart = getUTCStartDate(startDate, timezone);
    const utcEnd = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: utcStart,
          lte: utcEnd,
        },
      },
      select: {
        date: true,
        amount: true,
      },
    });

    const weekMap: Record<string, number> = {};

    for (const tx of transactions) {
      const localDate = fromZonedTime(tx.date, timezone);
      const weekIndex =
        Math.floor(
          differenceInCalendarDays(
            localDate,
            fromZonedTime(utcStart, timezone),
          ) / 7,
        ) + 1;

      const key = `Week ${weekIndex}`;
      weekMap[key] = (weekMap[key] ?? 0) + (tx.amount ?? 0);
    }

    return weekMap;
  }

  async getSpendingByMonth(
    startDate: string,
    endDate: string,
    userId: string,
  ): Promise<Record<string, number>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const startUTC = getUTCStartDate(startDate, timezone);
    const endUTC = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        date: {
          gte: startUTC,
          lte: endUTC,
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const monthMap: Record<string, number> = {};

    for (const tx of transactions) {
      const localDate = fromZonedTime(tx.date, timezone);
      const key = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}`;

      monthMap[key] = (monthMap[key] ?? 0) + (tx.amount ?? 0);
    }

    return monthMap;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // '2025-05-01' 형태
  }

  async getBudgetByCategory(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<ChartDataItem> {
    const raw = await this.getCategorySpendingSummary(
      userId,
      startDate,
      endDate,
    );
    return this.toChartDataItem(raw);
  }

  private toChartDataItem(data: Record<string, number>): ChartDataItem {
    const entries = Object.entries(data);
    let maxKey = '';
    let maxVal = -Infinity;
    let total = 0;

    for (const [k, v] of entries) {
      total += v;
      if (v > maxVal) {
        maxVal = v;
        maxKey = k;
      }
    }

    return {
      data,
      highlight: { key: maxKey, value: maxVal },
      meta: {
        total,
        average: parseFloat((total / entries.length).toFixed(2)),
      },
    };
  }
}
