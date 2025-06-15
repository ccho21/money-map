// 📁 transactions/date-range.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getUTCStartDate, getUTCEndDate } from '@/libs/date.util';
import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';

@Injectable()
export class DateRangeService {
  constructor(private prisma: PrismaService) {}

  async resolveDateRange(
    userId: string,
    query: TransactionGroupQueryDTO,
    timezone: string,
  ): Promise<{ start: Date; end: Date }> {
    if (query.timeframe === 'all') {
      const range = await this.prisma.transaction.aggregate({
        where: { userId, deletedAt: null },
        _min: { date: true },
        _max: { date: true },
      });

      const start =
        range._min.date ?? getUTCStartDate(query.startDate, timezone);
      const end =
        range._max.date ??
        getUTCEndDate(query.endDate ?? query.startDate, timezone);

      return { start, end };
    }

    return {
      start: getUTCStartDate(query.startDate, timezone),
      end: getUTCEndDate(query.endDate ?? query.startDate, timezone),
    };
  }
}
