// 📁 src/modules/recurring/data/RecurringDataService.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RecurringTransaction, TransactionType } from '@prisma/client';
import { InsightQueryDTO } from '@/insights/dto/query.dto';
import { ChartDataItem } from '@/insights/dto/chart-item.dto';
import { getUserTimezone } from '@/libs/timezone';
import { getUTCEndDate, getUTCStartDate } from '@/libs/date.util';

@Injectable()
export class RecurringDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserRecurringTransactionsWithHistory(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<
    (RecurringTransaction & {
      transactions: { id: string; amount: number; date: Date }[];
    })[]
  > {
    const { startDate, endDate, timeframe } = query;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    const utcStart = getUTCStartDate(startDate, timezone);
    const utcEnd = getUTCEndDate(endDate, timezone);

    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      include: {
        transactions: {
          where: {
            date: {
              gte: utcStart,
              lte: utcEnd,
            },
          },
          orderBy: { date: 'desc' },
          select: { id: true, amount: true, date: true },
        },
      },
    });
  }

  async buildRecurringSummaryFromData(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<ChartDataItem> {
    const { startDate, endDate, timeframe } = query;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);

    const utcStart = getUTCStartDate(startDate, timezone);
    const utcEnd = getUTCEndDate(endDate, timezone);

    const recurrings = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        type: TransactionType.expense,
        startDate: { lte: utcEnd }, // 시작일이 기간 이전
        OR: [
          { endDate: null }, // 아직 유효함
          { endDate: { gte: utcEnd } }, // 최소한 일부가 기간 내 포함
        ],
      },
      include: {
        
      },
    });

    const data: Record<string, number> = {};
    let highlight: { key: string; value: number } | undefined;
    let maxAmount = 0;
    let total = 0;

    for (const r of recurrings) {

      const name = r.note || 'Unnamed';
      const amountSum = r.amount;
      if (amountSum === 0) continue;

      data[name] = amountSum;
      total += amountSum;

      if (amountSum > maxAmount) {
        maxAmount = amountSum;
        highlight = { key: name, value: amountSum };
      }
    }

    return {
      data,
      highlight,
      meta: {
        total,
        average: Math.round(total / Object.keys(data).length || 1),
        timeframe: query.timeframe,
        startDate: query.startDate,
        endDate: query.endDate,
      },
    };
  }
}
