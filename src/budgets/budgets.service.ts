import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { BudgetAlert } from './types/budgets.types';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBudgetDto) {
    this.logger.debug(
      `🧾 Creating budget for user: ${userId}, total: ₩${dto.total}`,
    );

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        total: dto.total,
      },
    });

    const budgetCategories = dto.categories.map((cat) => {
      this.logger.debug(
        `📂 Assigning ₩${cat.amount} to category ${cat.categoryId}`,
      );
      return this.prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId: cat.categoryId,
          amount: cat.amount,
        },
      });
    });

    await Promise.all(budgetCategories);
    this.logger.log(`✅ Budget created: ${budget.id}`);
    return budget;
  }

  async findAllByUser(userId: string) {
    this.logger.debug(`🔍 Retrieving all budgets for user: ${userId}`);

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
    this.logger.debug(`🚨 Checking budget alerts for user: ${userId}`);

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
      this.logger.debug(
        `📊 Category: ${item.category.name}, Limit: ₩${item.amount}, Spent: ₩${totalSpent}`,
      );

      if (totalSpent > item.amount) {
        const exceededBy = totalSpent - item.amount;
        this.logger.warn(
          `⚠️ 예산 초과! ${item.category.name} - ₩${exceededBy} 초과`,
        );

        alerts.push({
          category: item.category.name,
          budget: item.amount,
          spent: totalSpent,
          exceededBy,
        });
      }
    }

    return alerts;
  }
}
