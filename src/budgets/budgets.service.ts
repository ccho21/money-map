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
import { isSameDay, parseISO } from 'date-fns';
import { getDateRangeList, getLocalDate, toUTC } from '@/libs/date.util';

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
      throw new NotFoundException('startDate, endDate, groupBy는 필수입니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = user.timezone || 'Asia/Seoul';

    const baseDate = parseISO(startDate);
    const ranges = getDateRangeList(baseDate, groupBy, timezone); // ✅ 중심 기준으로 12개 구간 생성

    const startUTC = toUTC(
      getLocalDate(ranges[0].startDate, timezone),
      timezone,
    );
    const endUTC = toUTC(getLocalDate(ranges[11].endDate, timezone), timezone);

    const allBudgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        category: { userId },
        startDate: { gte: startUTC },
        endDate: { lte: endUTC },
      },
      include: {
        category: true,
      },
    });

    if (!allBudgetCategories.length) {
      throw new NotFoundException('해당 카테고리 예산 정보가 없습니다.');
    }

    const categoryInfo = allBudgetCategories[0].category;

    let defaultAmount = 0;
    for (const range of ranges) {
      const match = allBudgetCategories.find(
        (b) =>
          isSameDay(b.startDate, getLocalDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getLocalDate(range.endDate, timezone)),
      );
      if (match) {
        defaultAmount = match.amount;
        break;
      }
    }

    const budgets: BudgetCategoryGroupItemDTO[] = ranges.map((range) => {
      const matched = allBudgetCategories.find((b) => {
        return (
          isSameDay(b.startDate, getLocalDate(range.startDate, timezone)) &&
          isSameDay(b.endDate, getLocalDate(range.endDate, timezone))
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
