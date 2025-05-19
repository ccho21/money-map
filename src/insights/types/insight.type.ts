export interface Insight {
  id: string;
  message: string;
  value?: string;
  severity: 'info' | 'warning' | 'positive';
  category: 'income' | 'expense' | 'transfer' | 'savings' | 'general';
  priority: number;
}