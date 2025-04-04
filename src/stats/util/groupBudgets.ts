import { addMonths, format, isSameMonth, parseISO } from 'date-fns';
import { BudgetCategory } from '@prisma/client';
import { BudgetCategoryGroupItemDTO } from '@/budgets/dto/budget-group.dto';

export function groupBudgets(
  baseStartDate: string,
  groupBy: string,
  budgetList: BudgetCategory[],
  defaultAmount = 100,
): BudgetCategoryGroupItemDTO[] {
  const baseDate = parseISO(baseStartDate);

  const months = Array.from({ length: 12 }, (_, i) => {
    const start = addMonths(baseDate, i);
    const end = addMonths(baseDate, i + 1);
    const startStr = format(start, 'yyyy-MM-01');
    const endStr = format(end, 'yyyy-MM-01');

    return {
      label: format(start, 'MMM'),
      startDate: startStr,
      endDate: endStr,
    };
  });

  const budgets: BudgetCategoryGroupItemDTO[] = months.map((month) => {
    const matched = budgetList.find(
      (b) =>
        format(b.startDate, 'yyyy-MM-01') === month.startDate &&
        format(b.endDate, 'yyyy-MM-01') === month.endDate,
    );

    const isCurrent = isSameMonth(parseISO(month.startDate), baseDate);

    return {
      label: month.label,
      startDate: month.startDate,
      endDate: month.endDate,
      budgetAmount: matched ? matched.amount : defaultAmount,
      isCurrent,
    };
  });

  return budgets;
}
