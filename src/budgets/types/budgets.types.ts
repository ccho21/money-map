export interface BudgetAlert {
  category: string;
  budget: number;
  spent: number;
  exceededBy: number;
}

export class BudgetUsageItem {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  usedAmount: number;
  usedPercent: number;
}
