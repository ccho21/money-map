// insights/rules/LateNightShoppingRule.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getUserTimezone } from '@/libs/timezone';
import { toZonedTime } from 'date-fns-tz';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class LateNightShoppingRule extends InsightRuleBase {
  constructor(
    private readonly transactionDataService: TransactionDataService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'insightPattern', 'chartFlow'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### LateNightShoppingRule ###');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');
    const timezone = getUserTimezone(user) ?? 'UTC';

    const txList = await this.transactionDataService.getRecentTransactions(userId, 7);

    const total = txList.length;
    if (total === 0) return [];

    const lateNightTxs = txList.filter(tx => {
      const localDate = toZonedTime(tx.date, timezone);
      const hour = localDate.getHours();
      return hour >= 21; // 21:00–23:59
    });

    const ratio = Math.round((lateNightTxs.length / total) * 100);
    if (ratio < 25) return [];

    return [
      {
        id: `lateNight.shopping`,
        title: 'Late-night shopping habit',
        description: `${ratio}% of shopping transactions happened after 9 PM.`,
        type: 'pattern',
        severity: ratio > 50 ? 'warning' : 'info',
        icon: 'shopping-bag',
        createdAt: formatISO(new Date()),
        context: {
          timezone,
          totalTxs: total,
          lateNightTxs: lateNightTxs.length,
          percent: ratio,
        },
      },
    ];
  }
}
