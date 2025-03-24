export interface TransactionFilter {
  type?: 'income' | 'expense';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
