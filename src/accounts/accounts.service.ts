import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import {
  endOfDay,
  endOfMonth,
  parse,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { TransactionDto } from 'src/transactions/dto/transaction.dto';
import { User } from '@prisma/client';
import { AccountTransactionSummaryDTO } from './dto/account-grouped-transactions';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // 계좌 생성
  async create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        color: dto.color ?? '#2196F3', // 기본 색상
      },
    });
  }

  // 유저의 모든 계좌 조회
  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 단일 계좌 조회
  async findOne(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return account;
  }

  // 계좌 삭제
  async remove(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.account.delete({
      where: { id: accountId },
    });
  }

  async getSummary(userId: string, year?: number, month?: number) {
    const dateFilter = (() => {
      if (!year || !month) return undefined;
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(start);
      return { gte: start, lte: end };
    })();

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const summaries = await Promise.all(
      accounts.map(async (account) => {
        const [income, expense] = await Promise.all([
          this.prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              accountId: account.id,
              type: 'income',
              ...(dateFilter && { date: dateFilter }),
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              accountId: account.id,
              type: 'expense',
              ...(dateFilter && { date: dateFilter }),
            },
          }),
        ]);

        const totalIncome = income._sum.amount ?? 0;
        const totalExpense = expense._sum.amount ?? 0;
        const balance = totalIncome - totalExpense;

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          color: account.color,
          totalIncome,
          totalExpense,
          balance,
        };
      }),
    );

    return summaries;
  }

  async getGroupedTransactions(
    userId: string,
    query: { startDate?: string; endDate?: string },
  ): Promise<AccountTransactionSummaryDTO[]> {
    const { startDate, endDate } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timeZone = this.getUserTimezone(user);

    // 날짜 파싱
    const parsedStart = startDate
      ? parse(startDate, 'yyyy-MM-dd', new Date())
      : null;
    const parsedEnd = endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : null;

    const startZoned = parsedStart ? toZonedTime(parsedStart, timeZone) : null;
    const endZoned = parsedEnd ? toZonedTime(parsedEnd, timeZone) : null;

    const startUTC = startZoned
      ? fromZonedTime(startOfDay(startZoned), timeZone)
      : undefined;
    const endUTC = endZoned
      ? fromZonedTime(endOfDay(endZoned), timeZone)
      : undefined;

    // 계좌 목록 조회
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const results: AccountTransactionSummaryDTO[] = [];

    for (const account of accounts) {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          userId,
          accountId: account.id,
          ...(startUTC && { date: { gte: startUTC } }),
          ...(endUTC && {
            date: { ...(startUTC ? { gte: startUTC } : {}), lte: endUTC },
          }),
        },
        orderBy: { date: 'asc' },
        include: {
          category: true,
          account: true,
        },
      });

      const txDtos: TransactionDto[] = transactions.map((tx) => ({
        id: tx.id,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        note: tx.note ?? '',
        accountId: tx.accountId,
        date: tx.date.toISOString(),
        category: {
          id: tx.category.id,
          name: tx.category.name,
          icon: tx.category.icon,
          type: tx.category.type,
        },
        account: {
          id: tx.account.id,
          name: tx.account.name,
          type: tx.account.type,
          color: tx.account.color,
        },
      }));

      const incomeTotal = txDtos
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenseTotal = txDtos
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      results.push({
        accountId: account.id,
        accountName: account.name,
        balance: account.balance,
        incomeTotal,
        expenseTotal,
        transactions: txDtos,
      });
    }

    return results;
  }

  private getUserTimezone(user: User): string {
    return user.timezone || 'America/Toronto';
  }
}
