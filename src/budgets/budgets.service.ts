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
import { BudgetGroupSummaryDTO } from './dto/budget-summary.dto';
import { BudgetCategoryItemDTO } from './dto/budgetCategory/budget-category-item.dto';
import { BudgetGroupItemDTO } from './dto/budget-group-item.dto';
import { BudgetCategoryPeriodItemDTO } from './dto/budget-category-period-item.dto';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { getUserTimezone } from '@/libs/timezone';
import { isSameDay, parseISO } from 'date-fns';
import { BudgetCategoryListResponseDTO } from './dto/budget-category-list-response.dto';
import { BudgetQueryDTO } from './dto/params/budget-query.dto';

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

  async getSummary(
    userId: string,
    { startDate, endDate, groupBy }: DateRangeWithGroupQueryDTO,
  ): Promise<BudgetGroupSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = user.timezone || 'America/Toronto';
    const from = getUTCStartDate(startDate, timezone);
    const to = getUTCEndDate(endDate, timezone);

    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: { budget: { userId } },
      select: { amount: true },
    });

    const totalBudget = budgetCategories.reduce(
      (sum, bc) => sum + bc.amount,
      0,
    );

    const expenses = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: { gte: from, lte: to },
      },
      select: { amount: true },
    });

    const totalSpent = expenses.reduce((sum, tx) => sum + tx.amount, 0);
    const rate =
      totalBudget === 0 ? 0 : Math.round((totalSpent / totalBudget) * 100);

    return {
      label: groupBy,
      rangeStart: startDate,
      rangeEnd: endDate,
      totalBudget,
      totalSpent: totalSpent,
      rate,
    };
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

    const items: BudgetCategoryItemDTO[] = categories.map((c) => {
      const bc = budgetMap.get(c.id);
      const amount = bc?.amount ?? 0;
      return {
        categoryId: c.id,
        categoryName: c.name,
        icon: c.icon,
        color: c.color ?? undefined,
        amount,
        used: 0,
        remaining: amount,
        isOver: false,
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
    const end = dto.endDate
      ? getUTCStartDate(dto.endDate, timezone)
      : undefined;

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
      throw new NotFoundException('startDate, endDate, groupBy는 필수입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const baseDate = parseISO(startDate);
    const ranges = getDateRangeList(baseDate, timeframe, timezone);

    const start = getUTCStartDate(ranges[0].startDate, timezone);
    const end = getUTCStartDate(ranges[ranges.length - 1].endDate, timezone);

    const allBudgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        category: { userId },
        startDate: { gte: start },
        endDate: { lte: end },
      },
      include: { category: true },
    });

    if (!allBudgetCategories.length) {
      throw new NotFoundException('해당 카테고리 예산 정보가 없습니다.');
    }

    const categoryInfo = allBudgetCategories[0].category;
    const categoryType = categoryInfo.type;

    let defaultAmount = 0;
    // defaultamount  구하는 방법이 조금 이상한것같아.
    // 버젯을 처음 셋팅한후에는, isCurrent: true 인 버젯 기준으로 default 버젯이설정되어야 되는데, 지금은,
    // allBudgetCategories 에서 startDate endDate 같은것 기준으로만 찾으니까 뭔가 지금 꼬이는거같은데,
    for (const range of ranges) {
      const match = allBudgetCategories.find(
        (b) =>
          isSameDay(b.startDate, getUTCStartDate(startDate, timezone)) &&
          isSameDay(b.endDate, getUTCStartDate(endDate, timezone)),
      );
      if (match && range.isCurrent) {
        defaultAmount = match.amount;
        break;
      }
    }

    const budgets: BudgetCategoryPeriodItemDTO[] = ranges.map((range) => {
      const matched = allBudgetCategories.find(
        (b) =>
          isSameDay(b.startDate, getUTCStartDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getUTCStartDate(range.endDate, timezone)),
      );

      const amount = matched ? matched.amount : defaultAmount;

      return {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        amount,
        used: 0,
        remaining: 0,
        isOver: false,
        isCurrent: range.isCurrent,
        categoryId: matched ? matched.categoryId : undefined,
        type: categoryType,
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
