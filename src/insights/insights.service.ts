// src/modules/insight/insight.service.ts

import { Injectable } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Insight } from './types/insight.type';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';

interface Period {
  period: string;
  income: number;
  expense: number;
  saved: number;
  rate: number;
}

@Injectable()
export class InsightService {
  buildChartFlowPeriods(
    transactions: Transaction[],
    timeframe: Timeframe,
    timezone: string,
  ): Period[] {
    const map = new Map<string, Period>();

    for (const tx of transactions) {
      const zoned = toZonedTime(tx.date, timezone);
      const key =
        timeframe === 'monthly'
          ? format(zoned, 'yyyy-MM')
          : timeframe === 'weekly'
            ? format(zoned, 'yyyy-ww')
            : format(zoned, 'yyyy-MM-dd');

      if (!map.has(key)) {
        map.set(key, {
          period: key,
          income: 0,
          expense: 0,
          saved: 0,
          rate: 0,
        });
      }

      const period = map.get(key)!;
      if (tx.type === 'income') period.income += tx.amount;
      if (tx.type === 'expense') period.expense += tx.amount;
    }

    for (const period of map.values()) {
      period.saved = period.income - period.expense;
      period.rate =
        period.income > 0
          ? Math.round((period.saved / period.income) * 100)
          : 0;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
  }

  generateFromChartPeriods(periods: Period[]): Insight[] {
    const insights: Insight[] = [];

    const totalIncome = periods.reduce((sum, p) => sum + p.income, 0);
    const totalExpense = periods.reduce((sum, p) => sum + p.expense, 0);
    const last = periods.at(-1);
    const secondLast = periods.length > 1 ? periods[periods.length - 2] : null;

    if (totalIncome > 0 && totalExpense / totalIncome > 0.95) {
      insights.push({
        id: 'spending-over-income',
        message: 'You spent nearly all your income.',
        value: `${Math.round((totalExpense / totalIncome) * 100)}%`,
        severity: 'warning',
        category: 'expense',
        priority: 1,
      });
    }

    if (last && secondLast) {
      const delta = last.expense - secondLast.expense;
      const growth = secondLast.expense > 0 ? delta / secondLast.expense : 0;

      if (growth > 0.2) {
        insights.push({
          id: 'spending-increased',
          message: 'Spending increased compared to last month.',
          value: `${(growth * 100).toFixed(1)}%`,
          severity: 'warning',
          category: 'expense',
          priority: 2,
        });
      } else if (growth < -0.2) {
        insights.push({
          id: 'spending-decreased',
          message: 'Spending decreased compared to last month.',
          value: `${Math.abs(growth * 100).toFixed(1)}%`,
          severity: 'positive',
          category: 'expense',
          priority: 3,
        });
      }
    }

    if (totalIncome > 0 && (totalIncome - totalExpense) / totalIncome >= 0.3) {
      insights.push({
        id: 'saved-over-30-percent',
        message: 'You saved over 30% of your income.',
        value: `${Math.round(((totalIncome - totalExpense) / totalIncome) * 100)}%`,
        severity: 'positive',
        category: 'savings',
        priority: 4,
      });
    }

    return insights;
  }
}
