import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { endOfDay, format, parse, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { BudgetDTO, BudgetSummary, BudgetSummaryDTO } from './dto/budget.dto';
import { CreateBudgetDTO } from './dto/create-budget.dto';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBudgetDTO) {
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

  async findAll(userId: string): Promise<BudgetDTO[]> {
    this.logger.debug(`🔍 Retrieving all budgets for user: ${userId}`);

    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        categories: true, // ✅ BudgetCategory[] 포함
      },
    });

    return budgets.map((b) => ({
      id: b.id,
      total: b.total,
      categoryIds: b.categories.map((c) => c.categoryId), // ✅ 핵심 수정
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async getBudgetSummary(
    userId: string,
    query: BudgetQueryDto,
  ): Promise<BudgetSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = user.timezone || 'Asia/Seoul';

    const startDateStr = query.startDate ?? format(new Date(), 'yyyy-MM-01');
    const endDateStr = query.endDate ?? format(new Date(), 'yyyy-MM-dd');

    const parsedStart = parse(startDateStr, 'yyyy-MM-dd', new Date());
    const parsedEnd = parse(endDateStr, 'yyyy-MM-dd', new Date());

    const startZoned = toZonedTime(parsedStart, timezone);
    const endZoned = toZonedTime(parsedEnd, timezone);

    const startUTC = fromZonedTime(startOfDay(startZoned), timezone);
    const endUTC = fromZonedTime(endOfDay(endZoned), timezone);

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
      },
      include: {
        category: true,
      },
    });

    const data: BudgetSummary[] = [];
    let totalBudget = 0;
    let totalExpense = 0;

    for (const bc of budgetCategories) {
      const used = await this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          categoryId: bc.categoryId,
          date: {
            gte: startUTC,
            lte: endUTC,
          },
        },
        _sum: { amount: true },
      });

      const usedAmount = used._sum.amount ?? 0;
      const percent =
        bc.amount === 0 ? 0 : Math.round((usedAmount / bc.amount) * 100);

      totalBudget += bc.amount;
      totalExpense += usedAmount;

      data.push({
        categoryId: bc.categoryId,
        categoryName: bc.category.name,
        budgetAmount: bc.amount,
        usedAmount,
        rate: percent,
      });
    }

    const rate =
      totalBudget === 0 ? 0 : Math.round((totalExpense / totalBudget) * 100);

    return {
      totalBudget,
      totalExpense,
      rate,
      data,
    };
  }
}

// async getBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
//   this.logger.debug(`🚨 Checking budget alerts for user: ${userId}`);

//   const budgets = await this.prisma.budgetCategory.findMany({
//     where: {
//       budget: {
//         userId,
//       },
//     },
//     include: {
//       category: true,
//       budget: true,
//     },
//   });

//   const alerts: BudgetAlert[] = [];

//   for (const item of budgets) {
//     const spent = await this.prisma.transaction.aggregate({
//       where: {
//         categoryId: item.categoryId,
//         userId,
//       },
//       _sum: { amount: true },
//     });

//     const totalSpent = spent._sum.amount || 0;
//     this.logger.debug(
//       `📊 Category: ${item.category.name}, Limit: ₩${item.amount}, Spent: ₩${totalSpent}`,
//     );

//     if (totalSpent > item.amount) {
//       const exceededBy = totalSpent - item.amount;
//       this.logger.warn(
//         `⚠️ 예산 초과! ${item.category.name} - ₩${exceededBy} 초과`,
//       );

//       alerts.push({
//         category: item.category.name,
//         budget: item.amount,
//         spent: totalSpent,
//         exceededBy,
//       });
//     }
//   }

//   return alerts;
// }
