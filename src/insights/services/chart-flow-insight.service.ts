// chart-flow-insight.service.ts
import { Injectable } from '@nestjs/common';
import { Insight } from '@/insights/types/insight.type';

interface Period {
  period: string;
  income: number;
  expense: number;
  saved: number;
  rate: number;
}

@Injectable()
export class ChartFlowInsightService {
  generateInsights(periods: Period[]): Insight[] {
    const insights: Insight[] = [];

    const totalIncome = periods.reduce((sum, p) => sum + p.income, 0);
    const totalExpense = periods.reduce((sum, p) => sum + p.expense, 0);
    const last = periods.at(-1);
    const secondLast = periods.length > 1 ? periods[periods.length - 2] : null;

    // 1. Spending exceeds 95% of income
    if (totalIncome > 0 && totalExpense / totalIncome > 0.95) {
      insights.push({
        id: 'spending-over-income',
        message: 'You spent nearly all of your income. Consider saving more.',
        severity: 'warning',
        category: 'expense',
        priority: 1,
      });
    }

    // 2. Saved over 30% of income
    if (totalIncome > 0 && (totalIncome - totalExpense) / totalIncome >= 0.3) {
      insights.push({
        id: 'saved-over-30-percent',
        message: 'You saved more than 30% of your income. Great job!',
        severity: 'positive',
        category: 'savings',
        priority: 2,
      });
    }

    // 3. Expense increased 20%+ from last month
    if (last && secondLast) {
      const growth = (last.expense - secondLast.expense) / secondLast.expense;
      if (growth > 0.2) {
        insights.push({
          id: 'spending-increased',
          message: 'Spending increased by more than 20% compared to last month.',
          severity: 'warning',
          category: 'expense',
          priority: 3,
        });
      }

      // 4. Expense decreased significantly
      if (growth < -0.2) {
        insights.push({
          id: 'spending-decreased',
          message: 'Spending decreased significantly compared to last month.',
          severity: 'positive',
          category: 'expense',
          priority: 4,
        });
      }
    }

    // 5. Income dropped for 2 consecutive months
    const last3 = periods.slice(-3);
    if (last3.length === 3 && last3[0].income > last3[1].income && last3[1].income > last3[2].income) {
      insights.push({
        id: 'income-2-month-drop',
        message: 'Your income has declined for two consecutive months. Monitor your income sources.',
        severity: 'warning',
        category: 'income',
        priority: 5,
      });
    }

    // 6. Fallback default summary
    if (!insights.length) {
      const percent = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : '0.0';
      insights.push({
        id: 'basic-summary',
        message: `Your total spending was ${percent}% of your income.`,
        severity: 'info',
        category: 'general',
        priority: 99,
      });
    }

    return insights;
  }
}
