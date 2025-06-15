// insights/rules/CardOveruseRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './base/InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class CardOveruseRule extends InsightRuleBase {
  constructor(private readonly transactionDataService: TransactionDataService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return [
      'dashboard',
      'insightPattern',
      'chartAccount',
      'insightBudget',
      'insightAlert',
    ];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### CardOveruseRule ###');
    const { total, card } =
      await this.transactionDataService.getExpenseBreakdownByAccountType(
        userId,
      );

    if (total === 0) return [];

    const percent = Math.round((card / total) * 100);
    if (percent < 70) return [];

    return [
      {
        id: 'cardOveruse.thisMonth',
        title: 'High card spending',
        description: `You used cards for ${percent}% of your expenses this month.`,
        type: 'alert',
        severity: percent >= 90 ? 'critical' : 'warning',
        icon: 'credit-card',
        createdAt: formatISO(new Date()),
        context: {
          totalExpense: total,
          cardExpense: card,
          cardRatio: percent,
        },
      },
    ];
  }
}
