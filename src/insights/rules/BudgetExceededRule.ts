// insights/rules/BudgetExceededRule.ts
import { Injectable } from '@nestjs/common';
import { formatISO } from 'date-fns';
import { InsightRuleBase } from './base/InsightRuleBase';
import { BudgetDataService } from '@/budgets/data/BudgetDataService';
import { TransactionDataService } from '@/transactions/data/transaction-data.service';
import { InsightContextType } from '../types/type';
import { InsightDTO } from '../dto/insight.dto';
import { InsightQueryDTO } from '../dto/query.dto';

@Injectable()
export class BudgetExceededRule extends InsightRuleBase {
  constructor(
    private readonly budgetDataService: BudgetDataService,
    private readonly transactionDataService: TransactionDataService,
  ) {
    super();
  }

  getSupportedContexts(): InsightContextType[] {
    return ['dashboard', 'chartBudget', 'insightPattern', 'insightAlert'];
  }

  async generate(
    userId: string,
    query: InsightQueryDTO,
  ): Promise<InsightDTO[]> {
    console.log('### BudgetExceededRule ###');
    const { startDate, endDate } = query;
    const budgets = await this.budgetDataService.getCurrentBudgets(userId);

    const txSummary =
      await this.transactionDataService.getCategorySpendingSummary(
        userId,
        startDate,
        endDate,
      );

    const insights: InsightDTO[] = [];

    for (const budget of budgets) {
      const spent = txSummary[budget.categoryId] ?? 0;
      if (spent > budget.amount) {
        const percentOver = Math.round(
          ((spent - budget.amount) / budget.amount) * 100,
        );
        insights.push({
          id: `budgetExceeded.${budget.categoryId}`,
          title: `${budget.categoryName} budget exceeded`,
          description: `You’ve spent ${percentOver}% more than your ${budget.categoryName} budget this month.`,
          type: 'budget',
          severity: percentOver > 50 ? 'critical' : 'warning',
          icon: 'badge-dollar-sign',
          createdAt: formatISO(new Date()),
          entityRef: { type: 'category', id: budget.categoryId },
          context: { budgeted: budget.amount, spent, percentOver },
          actionLabel: 'Adjust Budget',
          actionUrl: '/budget/settings',
        });
      }
    }

    return insights;
  }
}
