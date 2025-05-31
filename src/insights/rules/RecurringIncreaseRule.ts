// 📁 src/modules/insights/rules/RecurringIncreaseRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './base/InsightRuleBase';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';
import { RecurringDataService } from '@/recurring/data/RecurringDataService';

import { ChartDataItem } from '../dto/chart-item.dto';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';
import { RecurringInsightResponseDTO } from '../dto/recurring.dto';
import { InsightQueryDTO } from '../dto/query.dto';

@Injectable()
export class RecurringIncreaseRule extends InsightRuleBase {
  constructor(private readonly recurringDataService: RecurringDataService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['insightRecurring'];
  }

  async generate(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<InsightDTO[]> {
    const recurrings =
      await this.recurringDataService.getUserRecurringTransactionsWithHistory(
        userId,
        query,
      );
    const insights: InsightDTO[] = [];

    for (const r of recurrings) {
      const [latest, previous] = r.transactions;
      if (!latest || !previous || previous.amount === 0) continue;

      const increaseRatio = latest.amount / previous.amount;
      if (increaseRatio > 1.2) {
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
            increaseRatio,
          },
        });
      }
    }

    return insights;
  }
}
