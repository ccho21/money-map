export interface StatsSummaryByCategory {
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  income: number;
  expense: number;
  total: number;

  // 🔒 추후 확장용 필드
  // transactionCount?: number;
  // categoryMeta?: { icon: string; color: string };
}
export interface StatsSummaryByCategoryDTO {
  categoryId: string;
  categoryName: string;
  data: StatsSummaryByCategory[];
  incomeTotal: number;
  expenseTotal: number;
}
