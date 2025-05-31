import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './base/InsightRuleBase';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { CategoryDataService } from '@/categories/data/CategoryDataService';
import { InsightDTO } from '../dto/insight.dto';

@Injectable()
export class CategoryOverspendRule extends InsightRuleBase {
  constructor(
    private readonly transactionDataService: TransactionDataService,
    private readonly categoryDataService: CategoryDataService
  ) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'insightPattern', 'chartCategory', 'insightAlert'];
  }

  async generate(userId: string): Promise<InsightDTO[]> {
    console.log('### CategoryOverspendRule ###');

    const summary = await this.transactionDataService.getCategoryMonthlyComparison(userId);
    const overspent = Object.entries(summary)
      .filter(([_, val]) => val.previous > 0 && val.current / val.previous >= 2)
      .sort((a, b) => b[1].current - a[1].current);

    const insights: InsightDTO[] = [];

    for (const [categoryId, { current, previous }] of overspent.slice(0, 2)) {
      const category = await this.categoryDataService.getCategoryById(categoryId);
      if (!category) continue;

      const percentIncrease = Math.round((current / previous - 1) * 100);

      insights.push({
        id: `overspend.${categoryId}`,
        title: `${category.name} spending surged`,
        description: `Spending in ${category.name} increased by ${percentIncrease}% compared to last month.`,
        type: 'pattern',
        severity: percentIncrease > 150 ? 'warning' : 'info',
        icon: 'trending-up',
        createdAt: formatISO(new Date()),
        context: {
          categoryId,
          current,
          previous,
          percentIncrease,
        },
      });
    }

    return insights;
  }
}
