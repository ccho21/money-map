import { Injectable } from '@nestjs/common';
import { InsightContextType } from '../types/type';
import { formatISO } from 'date-fns';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightRuleBase } from './InsightRuleBase';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class WeekendSpendingRule extends InsightRuleBase {
  constructor(
    private readonly transactionDataService: TransactionDataService
  ) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'chartFlow', 'insightPattern'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### WeekendSpendingRule ###');

    const last7daysTx = await this.transactionDataService.getRecentTransactions(userId, 7);

    const totalSpent = last7daysTx.reduce((sum, tx) => sum + tx.amount, 0);
    const weekendSpent = last7daysTx
      .filter((tx) => {
        const day = new Date(tx.date).getDay();
        return day === 0 || day === 6; // Sunday (0), Saturday (6)
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (totalSpent === 0 || weekendSpent / totalSpent < 0.5) return [];

    const weekendRatio = Math.round((weekendSpent / totalSpent) * 100);

    return [
      {
        id: `weekendSpending.spike`,
        title: 'Weekend spending spike',
        description: `${weekendRatio}% of your spending occurred on Saturday and Sunday.`,
        type: 'pattern',
        severity: weekendRatio > 70 ? 'warning' : 'info',
        icon: 'calendar',
        createdAt: formatISO(new Date()),
        context: { weekendSpent, totalSpent, weekendRatio },
      },
    ];
  }
}
