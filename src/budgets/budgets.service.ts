import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { BudgetAlert } from './types/budgets.types';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBudgetDto) {
    const budget = await this.prisma.budget.create({
      data: {
        userId,
        total: dto.total,
      },
    });

    const budgetCategories = dto.categories.map((cat) => {
      return this.prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: cat.categoryId,
          amount: cat.amount,
        },
      });
    });

    await Promise.all(budgetCategories);
    return budget;
  }

  async findAllByUser(userId: string) {
    return this.prisma.budget.findMany({
      where: { userId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async getBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
    const budgets = await this.prisma.budgetCategory.findMany({
      where: {
        budget: {
          userId,
        },
      },
      include: {
        category: true,
        budget: true,
      },
    });

    const alerts: BudgetAlert[] = [];

    for (const item of budgets) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          categoryId: item.categoryId,
          userId,
        },
        _sum: { amount: true },
      });

      const totalSpent = spent._sum.amount || 0;

      if (totalSpent > item.amount) {
        alerts.push({
          category: item.category.name,
          budget: item.amount,
          spent: totalSpent,
          exceededBy: totalSpent - item.amount,
        });
      }
    }

    return alerts;
  }
}
