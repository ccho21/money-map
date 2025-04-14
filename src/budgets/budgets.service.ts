import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetDTO, BudgetSummaryDTO } from './dto/budget.dto';
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
import { format, isSameDay, parseISO } from 'date-fns';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { getUserTimezone } from '@/libs/timezone';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/date-range-with-group.dto';

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

  async getSummary(
    userId: string,
    { startDate, endDate }: DateRangeWithGroupQueryDTO,
  ): Promise<BudgetSummaryDTO> {
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

    const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);
    const rate =
      totalBudget === 0 ? 0 : Math.round((totalExpense / totalBudget) * 100);

    return {
      totalBudget,
      totalExpense,
      rate,
      rangeStart: format(from, 'yyyy-MM-dd'),
      rangeEnd: format(to, 'yyyy-MM-dd'),
    };
  }

  async getBudgetCategories(
    userId: string,
    query: DateRangeWithGroupQueryDTO,
  ): Promise<BudgetCategoryListDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new Error('User not found');

    const timezone = user.timezone || 'Asia/Seoul';

    const { startDate, endDate } = query;
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);
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

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

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
        type: category.type, // ✅ 카테고리에서 type을 가져와 명시적으로 저장
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

    const timezone = user.timezone || 'Asia/Seoul';

    const start = dto.startDate
      ? getUTCStartDate(dto.startDate, timezone)
      : undefined;
    const end = dto.endDate
      ? getUTCStartDate(dto.endDate, timezone)
      : undefined;

    const updated = await this.prisma.budgetCategory.update({
      where: { id: budgetId },
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
    query: DateRangeWithGroupQueryDTO,
  ): Promise<BudgetCategoryGroupResponseDTO> {
    const { startDate, endDate, groupBy } = query;

    if (!startDate || !endDate || !groupBy) {
      throw new NotFoundException('startDate, endDate, groupBy는 필수입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = user.timezone || 'Asia/Seoul';
    const baseDate = parseISO(startDate);
    const ranges = getDateRangeList(baseDate, groupBy, timezone);

    const start = getUTCStartDate(ranges[0].startDate, timezone);
    const end = getUTCStartDate(ranges[11].endDate, timezone);

    const allBudgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        category: { userId },
        startDate: { gte: start },
        endDate: { lte: end },
      },
      include: {
        category: true,
      },
    });

    if (!allBudgetCategories.length) {
      throw new NotFoundException('해당 카테고리 예산 정보가 없습니다.');
    }

    const categoryInfo = allBudgetCategories[0].category;
    const categoryType = categoryInfo.type;

    let defaultAmount = 0;
    for (const range of ranges) {
      const match = allBudgetCategories.find(
        (b) =>
          isSameDay(b.startDate, getUTCStartDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getUTCStartDate(range.endDate, timezone)),
      );
      if (match) {
        defaultAmount = match.amount;
        break;
      }
    }

    const budgets: BudgetCategoryGroupItemDTO[] = ranges.map((range) => {
      const matched = allBudgetCategories.find((b) => {
        return (
          isSameDay(b.startDate, getUTCStartDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getUTCStartDate(range.endDate, timezone))
        );
      });

      const amount = matched ? matched.amount : defaultAmount;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        budgetAmount: amount,
        isCurrent: range.isCurrent,
        categoryId: matched ? matched.categoryId : null,
        type: categoryType, // ✅ 추가: 예산 타입 포함
      };
    });

    return {
      categoryId,
      categoryName: categoryInfo.name,
      type: categoryInfo.type,
      icon: categoryInfo.icon,
      color: categoryInfo.color ?? undefined,
      budgets,
    };
  }
}
