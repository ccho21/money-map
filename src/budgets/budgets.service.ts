import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetDetailDTO } from './dto/budget/budget-detail.dto';
import {
  BudgetCategoryCreateRequestDTO,
  BudgetCategoryUpdateRequestDTO,
} from './dto/budget-category-request.dto';
import { BudgetCategoryItemDTO } from './dto/budgetCategory/budget-category-item.dto';
import { BudgetGroupItemDTO } from './dto/budget-group-item.dto';
import { BudgetCategoryPeriodItemDTO } from './dto/budget-category-period-item.dto';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { getUserTimezone } from '@/libs/timezone';
import { isSameDay, parseISO } from 'date-fns';
import { BudgetCategoryListResponseDTO } from './dto/budget-category-list-response.dto';
import { BudgetQueryDTO } from './dto/params/budget-query.dto';
import { BudgetCategory } from '@prisma/client';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string): Promise<BudgetDetailDTO[]> {
    this.logger.debug(`🔍 Retrieving all budgets for user: ${userId}`);

    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { categories: true },
    });

    return budgets.map((b) => ({
      id: b.id,
      total: b.total,
      categoryIds: b.categories.map((c) => c.categoryId),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async getBudgetCategories(
    userId: string,
    query: BudgetQueryDTO,
  ): Promise<BudgetCategoryListResponseDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const { startDate, endDate } = query;
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const categories = await this.prisma.category.findMany({
      where: { userId },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: { lte: start },
        endDate: { gte: end },
      },
    });

    const budgetMap = new Map(
      budgetCategories.map((bc) => [bc.categoryId, bc]),
    );

    const fallbackBudgets = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: { lt: start },
      },
      orderBy: { startDate: 'desc' },
    });

    const fallbackMap = new Map<string, BudgetCategory>();
    for (const fb of fallbackBudgets) {
      if (!budgetMap.has(fb.categoryId) && !fallbackMap.has(fb.categoryId)) {
        fallbackMap.set(fb.categoryId, fb);
      }
    }

    const usedMap = new Map<string, number>();
    for (const t of transactions) {
      if (!t.categoryId) continue;
      usedMap.set(t.categoryId, (usedMap.get(t.categoryId) ?? 0) + t.amount);
    }

    const items: BudgetCategoryItemDTO[] = categories.map((c) => {
      const bc = budgetMap.get(c.id) ?? fallbackMap.get(c.id);
      const amount = bc?.amount ?? 0;
      const used = usedMap.get(c.id) ?? 0;
      const remaining = amount - used;
      const isOver = remaining < 0;

      return {
        categoryId: c.id,
        categoryName: c.name,
        icon: c.icon,
        color: c.color ?? undefined,
        amount,
        used,
        remaining,
        isOver,
        type: c.type,
        budgetId: bc?.budgetId ?? undefined,
      };
    });

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    return { total, items };
  }

  async createBudgetCategory(
    userId: string,
    dto: BudgetCategoryCreateRequestDTO,
  ): Promise<{ budgetId: string; message: string }> {
    const { categoryId, amount, startDate, endDate } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const [budget] = await this.prisma.budget.findMany({
      where: { userId },
      take: 1,
    });
    if (!budget)
      throw new NotFoundException('No budget record found for user.');

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
        startDate: start,
        endDate: end,
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
        startDate: start,
        endDate: end,
        type: category.type,
      },
    });

    return {
      budgetId: created.id,
      message: 'Budget created successfully.',
    };
  }

  async updateBudgetCategory(
    userId: string,
    categoryId: string,
    dto: BudgetCategoryUpdateRequestDTO,
  ): Promise<{ budgetId: string; message: string }> {
    const budget = await this.prisma.budgetCategory.findFirst({
      where: { categoryId: categoryId },
      include: {
        budget: true,
        category: true, // ✅ category.type을 사용하기 위함
      },
    });

    if (!budget || budget.budget.userId !== userId) {
      throw new NotFoundException('Budget not found or access denied.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);

    const start = dto.startDate
      ? getUTCStartDate(dto.startDate, timezone)
      : undefined;
    const end = dto.endDate ? getUTCEndDate(dto.endDate, timezone) : undefined;

    const updated = await this.prisma.budgetCategory.update({
      where: { id: budget.id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(start && { startDate: start }),
        ...(end && { endDate: end }),
        type: budget.category.type, // ✅ type은 반드시 포함되어야 하므로 기존 값 사용
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
    query: BudgetQueryDTO,
  ): Promise<BudgetGroupItemDTO> {
    const { startDate, endDate, timeframe } = query;
    if (!startDate || !endDate || !timeframe) {
      throw new NotFoundException('startDate, endDate, timeFrame 필수입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const baseDate = parseISO(startDate);
    const ranges = getDateRangeList(baseDate, timeframe, timezone);

    const start = getUTCStartDate(ranges[0].startDate, timezone);
    const end = getUTCEndDate(ranges[ranges.length - 1].endDate, timezone);

    const allBudgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        category: { userId },
        startDate: { gte: start },
        endDate: { lte: end },
      },
      include: { category: true },
    });

    const categoryInfo =
      allBudgetCategories[0]?.category ??
      (await this.prisma.category.findUnique({
        where: { id: categoryId },
      }));

    if (!categoryInfo || categoryInfo.userId !== userId) {
      throw new NotFoundException('카테고리 정보가 없습니다.');
    }

    const categoryType = categoryInfo.type;

    // ✅ 각 기간별 Budget DTO 생성
    let latestAmount = 0;

    const budgets: BudgetCategoryPeriodItemDTO[] = ranges.map((range) => {
      const matched = allBudgetCategories.find(
        (b) =>
          isSameDay(b.startDate, getUTCStartDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getUTCStartDate(range.endDate, timezone)),
      );

      if (matched) {
        latestAmount = matched.amount;
      }

      return {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        amount: latestAmount,
        used: 0,
        remaining: 0,
        isOver: false,
        isCurrent: range.isCurrent,
        categoryId: categoryId,
        budgetId: matched?.budgetId,
        type: categoryType,
        isUnconfigured: !matched,
      };
    });

    return {
      categoryId,
      categoryName: categoryInfo.name,
      type: categoryType,
      icon: categoryInfo.icon,
      color: categoryInfo.color ?? undefined,
      totalBudget: budgets.reduce((sum, b) => sum + b.amount, 0),
      totalUsed: budgets.reduce((sum, b) => sum + b.used, 0),
      totalRemaining: budgets.reduce((sum, b) => sum + b.remaining, 0),
      isOver: budgets.some((b) => b.isOver),
      budgets,
    };
  }
}
