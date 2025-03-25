import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionFilter } from './dto/filter-transaction.dto';
import { Prisma } from '@prisma/client';
import { DetailDataDto, TransactionDto } from './dto/transaction-detail.dto';

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

  async findFilteredDetail(
    userId: string,
    filter: TransactionFilter,
  ): Promise<DetailDataDto> {
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

    return {
      incomeTotal,
      expenseTotal,
      transactions: transactionDtos,
    } as DetailDataDto;
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
