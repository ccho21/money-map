// 📁 src/modules/budget/data/BudgetDataService.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

interface BudgetCategoryInfo {
  categoryId: string;
  categoryName: string;
  amount: number;
}

@Injectable()
export class BudgetDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentBudgets(userId: string): Promise<BudgetCategoryInfo[]> {
    const budgets = await this.prisma.budgetCategory.findMany({
      where: {
        budget: {
          userId,
        },
      },
      select: {
        categoryId: true,
        amount: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    return budgets.map((b) => ({
      categoryId: b.categoryId,
      categoryName: b.category.name,
      amount: b.amount,
    }));
  }
}
