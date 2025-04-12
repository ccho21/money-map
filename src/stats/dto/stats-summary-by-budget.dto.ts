export interface StatsSummaryByBudget {
  label: string; // e.g. "Apr", "2025-04-11"
  startDate: string; // ISO
  endDate: string; // ISO
  expense: number;
  income: number;
  budgetAmount?: number;
  remaining?: number;

  isOver?: boolean;
  isCurrent: boolean;
}

export interface StatsSummaryByBudgetDTO {
  categoryId: string;
  categoryName: string;
  color: string;
  totalExpense: number;
  totalIncome: number;
  totalBudget?: number;
  totalRemaining?: number;
  isOver?: boolean;
  data: StatsSummaryByBudget[]; // 💡 unified monthly+daily
}
