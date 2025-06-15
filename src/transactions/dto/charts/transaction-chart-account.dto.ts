import { InsightDTO } from '@/insights/dto/insight.dto';

export interface AccountChartDTO {
  accountId: string;
  name: string;
  type: 'CASH' | 'BANK' | 'CARD';
  income: number;
  expense: number;
  balance: number;
  incomePercent: number;
  expensePercent: number;
  balancePercent: number;
  color?: string;
}

export interface TransactionChartAccountDTO {
  timeframe: string;
  startDate: string;
  endDate: string;
  accounts: AccountChartDTO[];
  insights: InsightDTO[];
}
