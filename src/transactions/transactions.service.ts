import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionFilter } from './dto/filter-transaction.dto';
import { Prisma } from '@prisma/client';
import {
  GroupedResponseDto,
  GroupedTransactionSummary,
  GroupQueryDto,
  TransactionDto,
} from './dto/transaction.dto';

export type TransactionFilterWhereInput = Prisma.TransactionWhereInput;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    this.logger.debug(
      `💸 Creating transaction for user: ${userId}, amount: ₩${dto.amount}`,
    );

    const transaction = await this.prisma.transaction.create({
      data: {
        ...dto,
        userId,
        date: new Date(dto.date),
      },
    });

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      this.logger.warn(`❌ 카테고리 없음: ${dto.categoryId}`);
      throw new Error('카테고리를 찾을 수 없습니다.');
    }

    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId: dto.categoryId,
        budget: { userId },
      },
    });

    if (budgetItem) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          categoryId: dto.categoryId,
          userId,
        },
        _sum: { amount: true },
      });

      const totalSpent: number = spent._sum.amount || 0;
      this.logger.debug(
        `📊 예산 체크 - 사용: ₩${totalSpent}, 제한: ₩${budgetItem.amount}`,
      );

      if (totalSpent > budgetItem.amount) {
        const exceed = totalSpent - budgetItem.amount;
        this.logger.warn(`🚨 예산 초과! ${category.name} - ₩${exceed}`);

        this.eventsGateway.emitBudgetAlert(userId, {
          category: category.name,
          message: `예산 초과! ₩${exceed}`,
        });
      }
    }

    this.logger.log(`✅ 거래 생성 완료: ${transaction.id}`);
    return transaction;
  }

  async findAllByUser(userId: string) {
    this.logger.debug(`🔍 findAllByUser → user: ${userId}`);
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    this.logger.debug(`✏️ update transaction ${id} for user ${userId}`);

    const found = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!found || found.userId !== userId) {
      this.logger.warn(`❌ 수정 권한 없음: ${id} by ${userId}`);
      throw new Error('수정 권한이 없습니다');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });

    this.logger.log(`✅ 거래 수정 완료: ${id}`);
    return updated;
  }

  async remove(userId: string, id: string) {
    this.logger.debug(`🗑️ remove transaction ${id} for user ${userId}`);

    const found = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!found || found.userId !== userId) {
      this.logger.warn(`❌ 삭제 권한 없음: ${id} by ${userId}`);
      throw new Error('삭제 권한이 없습니다');
    }

    const deleted = await this.prisma.transaction.delete({
      where: { id },
    });

    this.logger.log(`✅ 거래 삭제 완료: ${id}`);
    return deleted;
  }

  async findFiltered(
    userId: string,
    filter: TransactionFilter,
  ): Promise<TransactionDto[]> {
    this.logger.debug(
      `🔍 findFilteredDetail → user: ${userId}, filter: ${JSON.stringify(filter)}`,
    );

    const where: TransactionFilterWhereInput = { userId };

    if (filter.type) where.type = filter.type;
    if (filter.categoryId) where.categoryId = filter.categoryId;

    if (filter.startDate || filter.endDate) {
      const start =
        filter.startDate && !filter.startDate.endsWith('Z')
          ? `${filter.startDate}T00:00:00.000Z`
          : filter.startDate;
      const end =
        filter.endDate && !filter.endDate.endsWith('Z')
          ? `${filter.endDate}T23:59:59.999Z`
          : filter.endDate;

      where.date = {};
      if (start) where.date.gte = new Date(start);
      if (end) where.date.lte = new Date(end);
    }

    if (filter.search) {
      where.note = {
        contains: filter.search,
        mode: 'insensitive',
      };
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { category: true },
    });

    const transactionDtos: TransactionDto[] = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type as 'income' | 'expense',
      amount: tx.amount,
      note: tx.note as string,
      // paymentMethod: tx.paymentMethod,
      date: tx.date.toISOString(),
      category: {
        id: tx.category.id,
        name: tx.category.name,
        icon: tx.category.icon,
      },
    }));

    const incomeTotal = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenseTotal = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return transactionDtos;
  }

  async getGroupedTransactionData(
    userId: string,
    query: GroupQueryDto & { includeEmpty?: boolean },
  ): Promise<GroupedResponseDto> {
    const { range, date, includeEmpty = false } = query;

    const dateObj = new Date(date);
    let start: Date, end: Date, groupFormat: Intl.DateTimeFormatOptions;

    switch (range) {
      case 'date':
        start = new Date(date + 'T00:00:00.000Z');
        end = new Date(date + 'T23:59:59.999Z');
        groupFormat = { year: 'numeric', month: '2-digit', day: '2-digit' };
        break;
      case 'week': {
        const day = dateObj.getUTCDay();
        const diffToSun = day;
        const diffToSat = 6 - day;
        start = new Date(dateObj);
        start.setUTCDate(dateObj.getUTCDate() - diffToSun);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(dateObj);
        end.setUTCDate(dateObj.getUTCDate() + diffToSat);
        end.setUTCHours(23, 59, 59, 999);
        groupFormat = { year: 'numeric', month: '2-digit', day: '2-digit' };
        break;
      }
      case 'month':
        start = new Date(
          Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), 1),
        );
        end = new Date(
          Date.UTC(
            dateObj.getUTCFullYear(),
            dateObj.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        );
        groupFormat = { year: 'numeric', month: '2-digit', day: '2-digit' };
        break;
      case 'year':
        start = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
        end = new Date(
          Date.UTC(dateObj.getUTCFullYear(), 11, 31, 23, 59, 59, 999),
        );
        groupFormat = { year: 'numeric', month: '2-digit' }; // 월 단위 그룹핑
        break;
      default:
        throw new Error('Invalid range type');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
      include: { category: true },
    });

    const formatter = new Intl.DateTimeFormat('en-CA', groupFormat); // YYYY-MM or YYYY-MM-DD
    const grouped = new Map<string, TransactionDto[]>();

    for (const tx of transactions) {
      const label = formatter.format(tx.date);
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label)!.push({
        id: tx.id,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        note: tx.note ?? '',
        date: tx.date.toISOString(),
        category: {
          id: tx.category.id,
          name: tx.category.name,
          icon: tx.category.icon,
        },
      });
    }

    const data: GroupedTransactionSummary[] = [];
    let incomeTotal = 0;
    let expenseTotal = 0;
    const allLabels = new Set<string>();

    if (includeEmpty) {
      const current = new Date(start);
      while (current <= end) {
        const label = formatter.format(current);
        allLabels.add(label);
        if (range === 'year') {
          current.setUTCMonth(current.getUTCMonth() + 1);
        } else {
          current.setUTCDate(current.getUTCDate() + 1);
        }
      }
    } else {
      for (const label of grouped.keys()) {
        allLabels.add(label);
      }
    }

    for (const label of Array.from(allLabels).sort()) {
      const txs = grouped.get(label) ?? [];
      const groupIncome = txs
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0);
      const groupExpense = txs
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

      incomeTotal += groupIncome;
      expenseTotal += groupExpense;

      data.push({
        label,
        incomeTotal: groupIncome,
        expenseTotal: groupExpense,
        transactions: txs,
      });
    }

    return {
      range,
      baseDate: date,
      incomeTotal,
      expenseTotal,
      data,
    };
  }

  async getMonthlySummary(userId: string, month: string) {
    const startDate = new Date(`${month}-01T00:00:00.000Z`);
    const endDate = new Date(`${month}-31T23:59:59.999Z`);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // 날짜별 income / expense 나누기
    const summaryMap = new Map<string, { income: number; expense: number }>();

    grouped.forEach((g) => {
      const date = g.date.toISOString().split('T')[0];
      if (!summaryMap.has(date)) {
        summaryMap.set(date, { income: 0, expense: 0 });
      }

      const target = summaryMap.get(date)!;
      if (g.type === 'income') {
        target.income += g._sum.amount || 0;
      } else if (g.type === 'expense') {
        target.expense += g._sum.amount || 0;
      }
    });

    return Array.from(summaryMap.entries()).map(([date, summary]) => ({
      date,
      ...summary,
    }));
  }
}
