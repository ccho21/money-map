import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StatsQuery } from './dto/stats-query.dto';

import { getUserTimezone } from '@/libs/timezone';
import { groupTransactions } from './util/groupTransactions.util';
import {
  getDateRangeList,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { toZonedTime } from 'date-fns-tz';
import { endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoryStatsGroupDTO } from './dto/category-stats-group.dto';
import { BudgetStatsGroupDTO } from './dto/budget-stats-group.dto';
import { BudgetStatsItemDTO } from './dto/budget-stats-item.dto';
import { NoteStatsGroupDTO } from './dto/note-stats-group.dto';
import { TransactionGroupSummaryDTO } from '@/transactions/dto/transaction-group-summary.dto';
import { CategoryGroupSummaryResponseDTO } from './dto/category-group-summary-response.dto';
import { CategoryGroupSummaryDTO } from './dto/category-group-summary.dto';
import { BudgetGroupSummaryResponseDTO } from './dto/budget-group-summary-response.dto';
import { BudgetGroupSummaryDTO } from './dto/budget-group-summary.dto';
import { NoteGroupSummaryResponseDTO } from './dto/note-group-summary-response.dto';
import { CategoryStatsItemDTO } from './dto/category-stats-item.dto';
import { NoteSummaryItemNoteDTO } from './dto/note-summary-item-note.dto';
import { NoteStatsGroupItemDTO } from './dto/note-stats-group-item.dto';
import { NoteGroupSummaryDTO } from './dto/note-group-summary.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private prisma: PrismaService) {}

  async getByCategory(
    userId: string,
    query: StatsQuery,
  ): Promise<CategoryStatsGroupDTO> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 모든 카테고리 가져오기 (타입 기준)
    const categories = await this.prisma.category.findMany({
      where: {
        userId,
        type,
      },
    });
    // const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // ✅ 거래 합계 그룹화
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const amountMap = new Map(
      grouped.map((g) => [g.categoryId!, g._sum.amount ?? 0]),
    );

    // ✅ 예산 매핑
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId: { in: categories.map((c) => c.id) },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    const budgetMap = new Map(
      budgetCategories.map((b) => [
        b.categoryId,
        { budgetId: b.budgetId, amount: b.amount },
      ]),
    );

    // ✅ 총합 계산
    const totalAmount = Array.from(amountMap.values()).reduce(
      (sum, amt) => sum + amt,
      0,
    );

    // ✅ 결과 매핑 (모든 카테고리 포함)
    const data: CategoryStatsItemDTO[] = categories.map((category) => {
      const amount = amountMap.get(category.id) ?? 0;
      const budget = budgetMap.get(category.id);
      const rate =
        totalAmount > 0 ? Math.min((amount / totalAmount) * 100, 999) : 0;
      const budgetRate =
        budget && budget.amount > 0
          ? Math.min((amount / budget.amount) * 100, 999)
          : undefined;

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color ?? '#999999',
        amount,
        rate,
        ...(budget && {
          budgetId: budget.budgetId,
          budget: budget.amount,
          budgetRate,
        }),
      };
    });

    // ✅ 정렬
    data.sort((a, b) => b.amount - a.amount);

    return {
      data,
      totalIncome: type === 'income' ? totalAmount : 0,
      totalExpense: type === 'expense' ? totalAmount : 0,
    };
  }

  async getByBudget(
    userId: string,
    query: StatsQuery,
  ): Promise<BudgetStatsGroupDTO> {
    const { startDate, endDate, type } = query;
    if (!startDate || !endDate || !type) {
      throw new BadRequestException('startDate, endDate, type are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 해당 타입의 전체 카테고리 가져오기
    const categories = await this.prisma.category.findMany({
      where: {
        userId,
        type,
      },
    });

    // ✅ 예산 항목 가져오기 (해당 날짜 범위 포함)
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        categoryId: { in: categories.map((c) => c.id) },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const budgetMap = new Map(budgetCategories.map((b) => [b.categoryId, b]));

    // ✅ 트랜잭션 합계 그룹화
    const transactions = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: start, lte: end },
        type,
      },
      _sum: {
        amount: true,
      },
    });

    const txMap = new Map(
      transactions.map((tx) => [tx.categoryId!, tx._sum.amount ?? 0]),
    );

    // ✅ 모든 카테고리 포함하여 구성
    const data: BudgetStatsItemDTO[] = categories.map((category) => {
      const amount = txMap.get(category.id) ?? 0;
      const budget = budgetMap.get(category.id);
      const budgetAmount = budget?.amount ?? 0;

      const spent = category.type === 'expense' ? amount : 0;
      const income = category.type === 'income' ? amount : 0;
      const remaining = category.type === 'expense' ? budgetAmount - spent : 0;
      const rate =
        budgetAmount > 0 ? Math.min((amount / budgetAmount) * 100, 999) : 0;

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color ?? '#999999',
        amount: amount,
        budget: budgetAmount,
        spent,
        income,
        remaining,
        rate,
        hasBudget: !!budget,
      };
    });

    // ✅ 총합 계산
    const totalBudget = data.reduce((sum, item) => sum + (item.budget ?? 0), 0);
    const totalSpent = data.reduce((sum, item) => sum + (item.spent ?? 0), 0);
    const totalIncome = data.reduce((sum, item) => sum + (item.income ?? 0), 0);

    return {
      totalBudget,
      totalSpent,
      totalIncome,
      totalRemaining: totalBudget - totalSpent,
      startDate,
      endDate,
      data,
    };
  }

  async getStatsByNoteSummary(
    userId: string,
    query: StatsQuery,
  ): Promise<NoteStatsGroupDTO> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 전체 트랜잭션 가져오기 (노트 포함)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        account: true,
        category: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    type TxWithRelations = (typeof transactions)[number];
    // ✅ 노트 기준으로 그룹핑
    const noteMap = new Map<string, TxWithRelations[]>();

    for (const tx of transactions) {
      const note = tx.note?.trim() || '';
      if (!noteMap.has(note)) {
        noteMap.set(note, []);
      }
      noteMap.get(note)!.push(tx);
    }

    let totalIncome = 0;
    let totalExpense = 0;

    const data: NoteStatsGroupItemDTO[] = [];

    for (const [note, txList] of noteMap.entries()) {
      const grouped = groupTransactions(txList, groupBy, timezone); // ✅ returns TransactionSummary[]

      const incomeSum = grouped.reduce((sum, g) => sum + g.incomeTotal, 0);
      const expenseSum = grouped.reduce((sum, g) => sum + g.expenseTotal, 0);

      totalIncome += incomeSum;
      totalExpense += expenseSum;

      const summarized: NoteSummaryItemNoteDTO[] = grouped.map((g) => ({
        label: g.label,
        startDate: g.rangeStart, // ✅ field name 맞춤
        endDate: g.rangeEnd, // ✅ field name 맞춤
        income: g.incomeTotal,
        expense: g.expenseTotal,
        isCurrent: g.isCurrent ?? false,
      }));

      data.push({
        count: txList.length, // ✅ 트랜잭션 수 추가
        totalIncome: incomeSum,
        totalExpense: expenseSum,
        data: summarized,
      });
    }

    data.sort(
      (a, b) =>
        b.totalIncome + b.totalExpense - (a.totalIncome + a.totalExpense),
    );

    return {
      data,
      totalIncome,
      totalExpense,
    };
  }

  async getStatsCategory(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<TransactionGroupSummaryDTO> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type은 필수입니다.',
      );
    }

    // ✅ 유저 + 타임존 조회
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);

    // ✅ UTC 날짜 변환
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 거래 조회
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    // ✅ 거래 그룹핑 (by 일/주/월)
    const grouped = groupTransactions(transactions, groupBy, timezone);

    // ✅ 총합 계산
    const totalIncome = grouped.reduce((sum, d) => sum + d.incomeTotal, 0);
    const totalExpense = grouped.reduce((sum, d) => sum + d.expenseTotal, 0);

    // ✅ DTO 반환
    return {
      data: grouped,
      totalIncome,
      totalExpense,
      groupBy: groupBy,
      startDate: startDate,
      endDate: endDate,
    };
  }

  async getStatsBudgetCategory(
    userId: string,
    budgetCategoryId: string,
    query: StatsQuery,
  ): Promise<TransactionGroupSummaryDTO> {
    const { startDate, endDate, type, groupBy } = query;

    // ✅ 필수 파라미터 확인
    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy는 필수입니다.',
      );
    }

    // ✅ 유저 확인 + 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ 예산 항목 + 카테고리 포함 조회
    const budgetCategory = await this.prisma.budgetCategory.findUnique({
      where: { id: budgetCategoryId },
      include: {
        category: true,
        budget: true,
      },
    });

    // ✅ 권한 체크
    if (!budgetCategory || budgetCategory.budget.userId !== userId) {
      throw new ForbiddenException('해당 예산 항목에 접근할 수 없습니다.');
    }

    // ✅ 요청 타입과 예산 카테고리 타입 불일치 시 예외
    if (budgetCategory.category.type !== type) {
      throw new BadRequestException(
        `카테고리 타입(${budgetCategory.category.type})과 요청 타입(${type}))이 일치하지 않습니다.`,
      );
    }

    // ✅ 해당 예산의 거래 조회
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        categoryId: budgetCategory.categoryId,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    // ✅ 그룹화 처리
    const grouped = groupTransactions(transactions, groupBy, timezone);

    // ✅ 총합 계산
    const totalIncome =
      type === 'income'
        ? grouped.reduce((sum, d) => sum + d.incomeTotal, 0)
        : 0;

    const totalExpense =
      type === 'expense'
        ? grouped.reduce((sum, d) => sum + d.expenseTotal, 0)
        : 0;

    // ✅ 최종 응답
    return {
      data: grouped,
      totalIncome,
      totalExpense,
      groupBy: groupBy,
      startDate: startDate,
      endDate: endDate,
    };
  }
  async getStatsCategorySummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<CategoryGroupSummaryResponseDTO> {
    const { startDate, endDate, groupBy } = query;
    if (!startDate || !endDate || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    // const end = getUTCStartDate(endDate, timezone);

    // ✅ 1. 구간 생성
    const ranges = getDateRangeList(start, groupBy, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const type = category.type;

    // ✅ 2. 전체 트랜잭션 미리 가져오기
    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    // ✅ 3. 구간별 매핑을 위한 버킷 생성
    const bucketMap = new Map<string, number>(); // label → amount 합계

    for (const tx of txList) {
      const zoned = toZonedTime(tx.date, timezone);

      const matched = ranges.find((r) => {
        const start = parseISO(r.startDate); // ← string을 date로
        const end = parseISO(r.endDate); // ← string을 date로
        return isWithinInterval(zoned, {
          start: startOfDay(start),
          end: endOfDay(end),
        });
      });

      if (!matched) continue;

      const key = matched.label;
      const current = bucketMap.get(key) ?? 0;
      bucketMap.set(key, current + tx.amount);
    }

    // ✅ 4. 응답 데이터 매핑
    let total = 0;
    const data: CategoryGroupSummaryDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      total += sum;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? sum : 0,
        expense: type === 'expense' ? sum : 0,
        total: type === 'income' ? sum : -sum,
      };
    });

    return {
      data,
      totalIncome: type === 'income' ? total : 0,
      totalExpense: type === 'expense' ? total : 0,
      groupBy: groupBy,
      startDate: startDate,
      endDate: endDate,
      categoryId,
      categoryName: category.name,
    };
  }

  async getStatsBudgetSummary(
    userId: string,
    categoryId: string,
    query: StatsQuery,
  ): Promise<BudgetGroupSummaryResponseDTO> {
    const { startDate, endDate, groupBy } = query;

    if (!startDate || !endDate || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, groupBy는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCStartDate(endDate, timezone);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const type = category.type;

    const ranges = getDateRangeList(start, groupBy, timezone);

    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        type,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const budgetList = await this.prisma.budgetCategory.findMany({
      where: {
        categoryId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    const data: BudgetGroupSummaryDTO[] = ranges.map((range) => {
      const rangeStart = parseISO(range.startDate);
      const rangeEnd = parseISO(range.endDate);

      const total = txList
        .filter((tx) => {
          const zoned = toZonedTime(tx.date, timezone);
          return isWithinInterval(zoned, {
            start: startOfDay(rangeStart),
            end: endOfDay(rangeEnd),
          });
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const budget = budgetList.find(
        (b) =>
          isWithinInterval(rangeStart, {
            start: startOfDay(b.startDate),
            end: endOfDay(b.endDate),
          }) ||
          isWithinInterval(rangeEnd, {
            start: startOfDay(b.startDate),
            end: endOfDay(b.endDate),
          }),
      );

      const budgetAmount = budget?.amount;
      const remaining =
        budgetAmount !== undefined ? budgetAmount - total : undefined;
      const isOver = remaining !== undefined && remaining < 0;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        income: type === 'income' ? total : 0,
        expense: type === 'expense' ? total : 0,
        budgetAmount,
        remaining,
        isOver,
        isCurrent: range.isCurrent,
      };
    });

    const filtered = data.filter(
      (d) => parseISO(d.startDate) >= start && parseISO(d.endDate) <= end,
    );

    const totalExpense =
      type === 'expense' ? filtered.reduce((sum, d) => sum + d.expense, 0) : 0;

    const totalIncome =
      type === 'income' ? filtered.reduce((sum, d) => sum + d.income, 0) : 0;

    const totalBudget = filtered.reduce(
      (sum, d) => sum + (d.budgetAmount ?? 0),
      0,
    );
    const totalRemaining =
      totalBudget - (type === 'expense' ? totalExpense : totalIncome);
    const isOver = totalRemaining < 0;

    return {
      data,
      totalExpense,
      totalIncome,
      groupBy: groupBy,
      startDate: startDate,
      endDate: endDate,
      categoryId,
      categoryName: category.name,
      color: category.color ?? '#999999',
      totalBudget,
      totalRemaining,
      isOver,
    };
  }

  async getStatsNoteDetail(
    userId: string,
    encodedNote: string,
    query: StatsQuery,
  ): Promise<TransactionGroupSummaryDTO> {
    const { startDate, endDate, type, groupBy } = query;

    // ✅ 필수 파라미터 확인
    if (!startDate || !endDate || !type || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, type, groupBy는 필수입니다.',
      );
    }

    // ✅ 유저 + 타임존 확인
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // ✅ note decode + 빈 노트 처리
    const rawNote = decodeURIComponent(encodedNote).trim();
    const note = rawNote === '_' ? null : rawNote;

    // ✅ 해당 note의 거래 조회
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        note,
        date: { gte: start, lte: end },
      },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    // ✅ 그룹화 처리
    const grouped = groupTransactions(transactions, groupBy, timezone);

    // ✅ 총합 계산
    const totalIncome =
      type === 'income'
        ? grouped.reduce((sum, d) => sum + d.totalIncome, 0)
        : 0;

    const totalExpense =
      type === 'expense'
        ? grouped.reduce((sum, d) => sum + d.totalExpense, 0)
        : 0;

    return {
      groupBy: groupBy,
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      data: grouped,
    };
  }

  async getStatsNoteSummary(
    userId: string,
    encodedNote: string,
    query: StatsQuery,
  ): Promise<NoteGroupSummaryResponseDTO> {
    const { startDate, endDate, groupBy, type } = query;

    if (!startDate || !endDate || !groupBy || !type) {
      throw new BadRequestException(
        'startDate, endDate, groupBy, type는 필수입니다.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const timezone = getUserTimezone(user);

    const start = getUTCStartDate(startDate, timezone);

    const rawNote = decodeURIComponent(encodedNote).trim();
    const note = rawNote === '_' ? null : rawNote;

    const ranges = getDateRangeList(start, groupBy, timezone);

    const txList = await this.prisma.transaction.findMany({
      where: {
        userId,
        type,
        note,
        date: {
          gte: getUTCStartDate(ranges[0].startDate, timezone),
          lte: getUTCEndDate(ranges[ranges.length - 1].endDate, timezone),
        },
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const bucketMap = new Map<string, number>();

    for (const tx of txList) {
      const txDate = parseISO(tx.date.toISOString());

      const matched = ranges.find((r) => {
        const start = parseISO(r.startDate);
        const end = parseISO(r.endDate);
        return isWithinInterval(txDate, {
          start: startOfDay(start),
          end: endOfDay(end),
        });
      });

      if (!matched) continue;

      const key = matched.label;
      const current = bucketMap.get(key) ?? 0;
      bucketMap.set(key, current + tx.amount);
    }

    let total = 0;
    const data: NoteGroupSummaryDTO[] = ranges.map((range) => {
      const sum = bucketMap.get(range.label) ?? 0;
      total += sum;

      return {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
        isCurrent: range.isCurrent,
        income: type === 'income' ? sum : 0,
        expense: type === 'expense' ? sum : 0,
      };
    });

    return {
      note,
      groupBy: groupBy,
      startDate: startDate,
      endDate: endDate,
      totalIncome: type === 'income' ? total : 0,
      totalExpense: type === 'expense' ? total : 0,
      data,
    };
  }
}
