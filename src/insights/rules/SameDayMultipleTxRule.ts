// insights/rules/SameDayMultipleTxRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightContextType } from '../types/type';
import { InsightRuleBase } from './InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class SameDayMultipleTxRule extends InsightRuleBase {
  constructor(private readonly transactionDataService: TransactionDataService) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'insightPattern'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### SameDayMultipleTxRule ###');
    const txs = await this.transactionDataService.getExpenseTransactionsByDate(userId, 7);

    // (categoryId + date) 조합별 개수 집계
    const map = new Map<string, { categoryId: string; date: string; count: number }>();

    for (const tx of txs) {
      if (!tx.categoryId) continue;
      const key = `${tx.categoryId}_${tx.date}`;
      if (!map.has(key)) {
        map.set(key, { categoryId: tx.categoryId, date: tx.date, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    }

    const insights: InsightDTO[] = [];
    for (const { categoryId, date, count } of map.values()) {
      if (count >= 3) {
        insights.push({
          id: `sameDayMultipleTx.${categoryId}.${date}`,
          title: 'Frequent transactions in one day',
          description: `You had ${count} transactions in the same category on ${date}.`,
          type: 'pattern',
          severity: count >= 5 ? 'warning' : 'info',
          icon: 'chevrons-up-down',
          createdAt: formatISO(new Date()),
          context: { categoryId, date, count },
          entityRef: {
            type: 'category',
            id: categoryId,
          },
        });
      }
    }

    return insights;
  }
}
