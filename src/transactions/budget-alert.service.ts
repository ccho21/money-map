import { EventsGateway } from '@/events/events.gateway';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BudgetAlertService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async checkAndEmit(userId: string, categoryId: string, date: Date) {
    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId,
        budget: { userId },
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (!budgetItem) return;

    const spent = await this.prisma.transaction.aggregate({
      where: {
        categoryId,
        userId,
        type: 'expense',
        date: { gte: budgetItem.startDate, lte: budgetItem.endDate },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const totalSpent = spent._sum.amount ?? 0;

    if (totalSpent > budgetItem.amount) {
      // const exceed = totalSpent - budgetItem.amount;
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      this.eventsGateway.emitBudgetAlert(userId, {
        category: category?.name ?? 'Unknown',
        message: `You've exceeded your $${budgetItem.amount.toLocaleString()} budget for "${category?.name ?? 'Unknown'}". \n Total spent: $${totalSpent.toLocaleString()}.`,
      });
    }
  }
}
