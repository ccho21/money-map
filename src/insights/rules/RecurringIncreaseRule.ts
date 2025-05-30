import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { InsightRuleBase } from './InsightRuleBase';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class RecurringIncreaseRule extends InsightRuleBase {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### RecurringIncreaseRule ###');
    const recurrings = await this.prisma.recurringTransaction.findMany({
      where: { userId },
      include: {
        transactions: { orderBy: { date: 'desc' }, take: 2 },
      },
    });

    const insights: InsightDTO[] = [];
    for (const r of recurrings) {
      const [latest, previous] = r.transactions;
      if (!latest || !previous) continue;
      if (previous.amount === 0) continue;
      if (latest.amount > previous.amount * 1.2) {
        insights.push({
          id: `recurringIncrease.${r.id}`,
          title: 'Recurring amount increased',
          description: `Amount for "${r.description ?? 'recurring'}" increased from ${previous.amount} to ${latest.amount}.`,
          type: 'recurring',
          severity: 'info',
          icon: 'repeat',
          createdAt: formatISO(new Date()),
          entityRef: { type: 'transaction', id: latest.id },
          context: {
            previousAmount: previous.amount,
            currentAmount: latest.amount,
          },
        });
      }
    }

    return insights;
  }
}
