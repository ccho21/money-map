// insights/rules/IncomeDropRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class IncomeDropRule extends InsightRuleBase {
  constructor(private readonly transactionDataService: TransactionDataService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'insightPattern', 'insightBudget'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### IncomeDropRule ###');
    const { current, previous } = await this.transactionDataService.getIncomeTotalsForTwoMonths(userId);

    if (previous === 0 || current >= previous * 0.5) return [];

    const dropPercent = Math.round(((previous - current) / previous) * 100);

    return [
      {
        id: 'incomeDrop.monthly',
        title: 'Income dropped this month',
        description: `Your income decreased by ${dropPercent}% compared to last month.`,
        type: 'alert',
        severity: dropPercent > 70 ? 'critical' : 'warning',
        icon: 'trending-down',
        createdAt: formatISO(new Date()),
        context: { current, previous, dropPercent },
      },
    ];
  }
}
