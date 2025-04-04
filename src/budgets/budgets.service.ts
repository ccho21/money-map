import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { BudgetDTO, BudgetSummary, BudgetSummaryDTO } from './dto/budget.dto';
import {
  BudgetCategoryListDTO,
  CreateBudgetCategoryDTO,
  CreateBudgetCategoryResponseDTO,
  UpdateBudgetCategoryDTO,
  UpdateBudgetCategoryResponseDTO,
} from './dto/budget-category.dto';
import {
  BudgetCategoryGroupItemDTO,
  BudgetCategoryGroupResponseDTO,
} from './dto/budget-group.dto';
import { CategoryType } from '@prisma/client';
import { format, addMonths, isSameMonth, parseISO } from 'date-fns';
import { getLocalDate, toUTC } from '@/libs/date.util';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string): Promise<BudgetDTO[]> {
    this.logger.debug(`🔍 Retrieving all budgets for user: ${userId}`);

    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        categories: true,
      },
    });

    return budgets.map((b) => ({
      id: b.id,
      total: b.total,
      categoryIds: b.categories.map((c) => c.categoryId),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async getBudgetSummary(
    userId: string,
    query: BudgetQueryDto,
  ): Promise<BudgetSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = user.timezone || 'America/Toronto';

    const start = getLocalDate(query.startDate, timezone);
    const end = getLocalDate(query.endDate, timezone);

    const startUTC = toUTC(start, timezone);
    const endUTC = toUTC(end, timezone);

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

  async getBudgetCategories(
    userId: string,
    query: BudgetQueryDto,
  ): Promise<BudgetCategoryListDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');

    const timezone = user.timezone || 'Asia/Seoul';

    const { startDate, endDate } = query;
    const start = toUTC(getLocalDate(startDate, timezone), timezone);
    const end = toUTC(getLocalDate(endDate, timezone), timezone);
    const categories = await this.prisma.category.findMany({
      where: { userId },
    });

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: start,
        endDate: end,
      },
    });

    const budgetMap = new Map<string, (typeof budgetCategories)[0]>();
    for (const bc of budgetCategories) {
      budgetMap.set(bc.categoryId, bc);
    }

    const data = categories.map((c) => {
      const bc = budgetMap.get(c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color ?? undefined,
        budgetId: bc?.id ?? null,
        budgetAmount: bc?.amount ?? 0,
        startDate,
        endDate,
        isNew: !bc,
      };
    });

    const total = data.reduce((sum, item) => sum + item.budgetAmount, 0);

    return {
      total,
      data,
    };
  }

  async createBudgetCategory(
    userId: string,
    dto: CreateBudgetCategoryDTO,
  ): Promise<CreateBudgetCategoryResponseDTO> {
    const { categoryId, amount, startDate, endDate } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = user.timezone || 'Asia/Seoul';

    // ✅ 날짜 변환: Local 기준 00시 → UTC
    const startUTC = toUTC(getLocalDate(startDate, timezone), timezone);
    const endUTC = toUTC(getLocalDate(endDate, timezone), timezone);

    const [budget] = await this.prisma.budget.findMany({
      where: { userId },
      take: 1,
    });

    if (!budget) {
      throw new NotFoundException('No budget record found for user.');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== userId) {
      throw new NotFoundException('Invalid category or access denied.');
    }

    const exists = await this.prisma.budgetCategory.findFirst({
      where: {
        budgetId: budget.id,
        categoryId,
        startDate: startUTC,
        endDate: endUTC,
      },
    });

    if (exists) {
      throw new ConflictException(
        'Budget already exists for this category and period.',
      );
    }

    const created = await this.prisma.budgetCategory.create({
      data: {
        budgetId: budget.id,
        categoryId,
        amount,
        startDate: startUTC,
        endDate: endUTC,
      },
    });

    return {
      budgetId: created.id,
      message: 'Budget created successfully.',
    };
  }

  async updateBudgetCategory(
    userId: string,
    budgetId: string,
    dto: UpdateBudgetCategoryDTO,
  ): Promise<UpdateBudgetCategoryResponseDTO> {
    const budget = await this.prisma.budgetCategory.findUnique({
      where: { id: budgetId },
      include: { budget: true },
    });

    if (!budget || budget.budget.userId !== userId) {
      throw new NotFoundException('Budget not found or access denied.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = user.timezone || 'Asia/Seoul';

    // ✅ 날짜 변환
    const startUTC = dto.startDate
      ? toUTC(getLocalDate(dto.startDate, timezone), timezone)
      : undefined;
    const endUTC = dto.endDate
      ? toUTC(getLocalDate(dto.endDate, timezone), timezone)
      : undefined;

    const updated = await this.prisma.budgetCategory.update({
      where: { id: budgetId },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(startUTC && { startDate: startUTC }),
        ...(endUTC && { endDate: endUTC }),
      },
    });

    return {
      budgetId: updated.id,
      message: 'Budget updated successfully.',
    };
  }

  async getGroupedBudgetCategories(
    userId: string,
    categoryId: string,
    query: BudgetQueryDto,
  ): Promise<BudgetCategoryGroupResponseDTO> {
    const { startDate, endDate, groupBy } = query;

    if (!startDate || !endDate || !groupBy) {
      throw new NotFoundException('startDate endDate, groupBy는 필수입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = user.timezone || 'Asia/Seoul';

    const baseDate = parseISO(startDate);

    const months = Array.from({ length: 12 }, (_, i) => {
      const start = addMonths(baseDate, i);
      const end = addMonths(baseDate, i + 1);
      return {
        label: format(start, 'MMM'),
        startDate: format(start, 'yyyy-MM-01'),
        endDate: format(end, 'yyyy-MM-01'),
      };
    });

    const startUTC = toUTC(
      getLocalDate(months[0].startDate, timezone),
      timezone,
    );
    const endUTC = toUTC(getLocalDate(months[11].endDate, timezone), timezone);

    const allBudgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        category: { userId },
        startDate: { gte: startUTC },
        endDate: { lt: endUTC },
      },
      include: {
        category: true,
      },
    });

    if (!allBudgetCategories.length) {
      throw new NotFoundException('해당 카테고리 예산 정보가 없습니다.');
    }

    const categoryInfo = allBudgetCategories[0].category;

    const budgets: BudgetCategoryGroupItemDTO[] = months.map((month) => {
      const matched = allBudgetCategories.find(
        (b) =>
          format(b.startDate, 'yyyy-MM-01') === month.startDate &&
          format(b.endDate, 'yyyy-MM-01') === month.endDate,
      );

      const isCurrent = isSameMonth(
        parseISO(month.startDate),
        parseISO(startDate),
      );

      return {
        label: month.label,
        startDate: month.startDate,
        endDate: month.endDate,
        budgetAmount: matched ? matched.amount : 100,
        isCurrent,
      };
    });

    return {
      categoryId,
      categoryName: categoryInfo.name,
      type: categoryInfo.type as CategoryType,
      icon: categoryInfo.icon,
      color: categoryInfo.color ?? undefined,
      budgets,
    };
  }
}
