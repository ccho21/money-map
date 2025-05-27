// insights/rules/NoSavingsRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class NoSavingsRule extends InsightRuleBase {
  constructor(private readonly transactionDataService: TransactionDataService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'insightPattern'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### NoSavingsRule ###')
    const { income, expense } = await this.transactionDataService.getMonthlyIncomeExpenseTotals(userId);

    if (income === 0 || expense < income) return [];

    const usedPercent = Math.round((expense / income) * 100);

    return [
      {
        id: 'noSavings.thisMonth',
        title: 'No savings this month',
        description: `You’ve used up ${usedPercent}% of your income this month.`,
        type: 'alert',
        severity: usedPercent > 100 ? 'critical' : 'warning',
        icon: 'credit-card',
        createdAt: formatISO(new Date()),
        context: { income, expense, usedPercent },
      },
    ];
  }
}
