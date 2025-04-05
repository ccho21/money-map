import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAccountDTO } from './dto/create-account.dto';
import { UpdateAccountDTO } from './dto/update-account.dto';
import { TransactionDTO } from 'src/transactions/dto/transaction.dto';
import {
  AccountTransactionFilterQueryDTO,
  AccountTransactionSummaryDTO,
} from './dto/account-grouped-transactions';
import { getUserTimezone } from '@/libs/timezone';
import {
  getDateRangeAndLabelByGroup,
  getLocalDate,
  getUTCDate,
  getValidDay,
  toUTC,
} from '@/libs/date.util';
import {
  AccountDashboardItemDTO,
  AccountDashboardResponseDTO,
} from './dto/account-dashboard-response.dto';
import { toZonedTime } from 'date-fns-tz';
import { subMonths } from 'date-fns';
import { Prisma, TransactionType } from '@prisma/client';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = toZonedTime(new Date(), timezone).toISOString();
    const nowUTC = getLocalDate(now, timezone);
    const year = nowUTC.getFullYear();
    const month = nowUTC.getMonth() + 1;

    let settlementDate: number | null = null;
    let paymentDate: number | null = null;
    let autoPayment = false;

    if (dto.type === 'CARD') {
      settlementDate = dto.settlementDate
        ? getValidDay(year, month, dto.settlementDate)
        : null;

      paymentDate = dto.paymentDate
        ? getValidDay(year, month, dto.paymentDate)
        : null;

      autoPayment = dto.autoPayment ?? false;
    }

    return await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          userId,
          name: dto.name,
          balance: 0, // ✅ 초기에는 0으로 설정 (잔액은 트랜잭션으로 반영됨)
          description: dto.description ?? null,
          type: dto.type,
          color: dto.color ?? '#2196F3',
          settlementDate,
          paymentDate,
          autoPayment,
        },
      });

      // ✅ 초기 금액이 있다면 Opening Deposit 생성 (type = 'income')
      if (dto.balance && Number(dto.balance) > 0) {
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: 'income',
            amount: Number(dto.balance),
            date: nowUTC, // 타임존 기반 UTC
            note: 'Opening Balance',
            description: 'Account created with initial balance',
          },
        });
      }

      // ✅ 계좌 잔액 재계산
      await this.recalculateAccountBalanceInTx(tx, account.id);

      return account;
    });
  }

  async update(userId: string, accountId: string, dto: UpdateAccountDTO) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    if (!account) {
      throw new Error('Account not found');
    }
    const now = toZonedTime(new Date(), timezone);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let settlementDate: number | null = null;
    let paymentDate: number | null = null;
    let autoPayment = false;

    if (dto.type === 'CARD') {
      settlementDate = dto.settlementDate
        ? getValidDay(year, month, dto.settlementDate)
        : null;

      paymentDate = dto.paymentDate
        ? getValidDay(year, month, dto.paymentDate)
        : null;

      autoPayment = dto.autoPayment ?? false;
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        name: dto.name,
        balance: Number(dto.balance),
        description: dto.description ?? null,
        type: dto.type,
        color: dto.color ?? '#2196F3',
        settlementDate,
        paymentDate,
        autoPayment,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');
    return account;
  }

  async remove(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');

    return this.prisma.account.delete({ where: { id: accountId } });
  }

  // ✅ 요약 API - 타임존 로직 개선
  async getSummary(userId: string, year?: number, month?: number) {
    if (!year || !month) return undefined;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);

    const baseDate = new Date(year, month - 1, 1);
    const { rangeStart, rangeEnd } = getDateRangeAndLabelByGroup(
      baseDate,
      'monthly',
      timezone,
    );

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
              date: { gte: rangeStart, lte: rangeEnd },
            },
          }),
          this.prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
              userId,
              accountId: account.id,
              type: 'expense',
              date: { gte: rangeStart, lte: rangeEnd },
            },
          }),
        ]);

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          color: account.color,
          totalIncome: income._sum.amount ?? 0,
          totalExpense: expense._sum.amount ?? 0,
          balance: (income._sum.amount ?? 0) - (expense._sum.amount ?? 0),
        };
      }),
    );

    return summaries;
  }

  async getGroupedTransactions(
    userId: string,
    query: AccountTransactionFilterQueryDTO,
  ): Promise<AccountTransactionSummaryDTO[]> {
    const { startDate, endDate } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const startUTC = toUTC(startDate, timezone);
    const endUTC = toUTC(endDate, timezone);

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
          date: { gte: startUTC, lte: endUTC },
        },
        orderBy: { date: 'asc' },
        include: { category: true, account: true },
      });

      const txDtos: TransactionDTO[] = transactions.map((tx) => ({
        id: tx.id,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        note: tx.note ?? '',
        accountId: tx.accountId,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        category: tx.category
          ? {
              id: tx.category.id,
              name: tx.category.name,
              icon: tx.category.icon,
              type: tx.category.type,
              color: tx.category.color as string,
            }
          : undefined,
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

  async getAccountsDashboard(
    userId: string,
  ): Promise<AccountDashboardResponseDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const nowUTC = toUTC(new Date(), timezone);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const [accounts, allCardTransactions] = await Promise.all([
          tx.account.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          }),
          tx.transaction.findMany({
            where: {
              userId,
              account: { type: 'CARD' },
              type: { in: ['expense', 'income', 'transfer'] },
              paidAt: null,
            },
            select: {
              type: true,
              amount: true,
              date: true,
              accountId: true,
              toAccountId: true,
            },
          }),
        ]);

        const response: AccountDashboardResponseDTO = {
          asset: 0,
          liability: 0,
          total: 0,
          data: {
            CASH: [],
            BANK: [],
            CARD: [],
          },
        };

        for (const account of accounts) {
          const isCard = account.type === 'CARD';
          const accountType = isCard ? 'LIABILITY' : ('ASSET' as const);

          // ✅ 자산 누적
          if (accountType === 'ASSET') {
            response.asset += account.balance;
          }

          // ✅ 카드 부채 계산 (잔액이 음수일 경우만 부채 반영)
          if (isCard && account.balance < 0) {
            response.liability += Math.abs(account.balance);
          }

          const base: AccountDashboardItemDTO = {
            id: account.id,
            name: account.name,
            type: account.type,
            financialType: accountType,
            amount: account.balance,
          };

          // ✅ 정산 정보 추가
          if (isCard && account.settlementDate !== null) {
            const year = nowUTC.getFullYear();
            const month = nowUTC.getMonth() + 1;

            const settleEnd = new Date(
              year,
              month - 1,
              getValidDay(year, month, account.settlementDate),
            );
            const prevMonth = subMonths(nowUTC, 1);
            const settleStart = new Date(
              prevMonth.getFullYear(),
              prevMonth.getMonth(),
              getValidDay(
                prevMonth.getFullYear(),
                prevMonth.getMonth() + 1,
                account.settlementDate,
              ) + 1,
            );

            const cardTxs = allCardTransactions.filter(
              (t) => t.accountId === account.id || t.toAccountId === account.id,
            );

            // ✅ 정산 기간 내
            const balancePayable = cardTxs
              .filter((t) => t.date >= settleStart && t.date <= settleEnd)
              .reduce(
                (sum, tx) => sum + this.getTransactionDelta(tx, account.id),
                0,
              );

            // ✅ 정산 이후 ~ 현재까지
            const outstandingBalance = cardTxs
              .filter((t) => t.date > settleEnd && t.date <= nowUTC)
              .reduce(
                (sum, tx) => sum + this.getTransactionDelta(tx, account.id),
                0,
              );

            Object.assign(base, { balancePayable, outstandingBalance });
          }

          response.data[account.type].push(base);
        }

        response.total = response.asset - response.liability;
        return response;
      });

      return result;
    } catch (err) {
      this.logger.error('📉 [getAccountsDashboard] 실패:', err);
      throw new Error('계좌 요약 정보를 불러오는 데 실패했습니다.');
    }
  }

  private getTransactionDelta(
    tx: {
      type: TransactionType;
      amount: number;
      accountId: string;
      toAccountId?: string | null;
    },
    targetAccountId: string,
  ): number {
    if (tx.type === 'expense' && tx.accountId === targetAccountId)
      return -tx.amount;

    if (tx.type === 'income' && tx.accountId === targetAccountId)
      return tx.amount;

    if (tx.type === 'transfer') {
      if (tx.accountId === targetAccountId && tx.toAccountId) return -tx.amount; // 출금
      if (tx.accountId === targetAccountId && !tx.toAccountId) return tx.amount; // 입금 (linked)
      if (tx.toAccountId === targetAccountId) return tx.amount; // 입금
    }

    return 0;
  }

  async recalculateAccountBalanceInTx(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<number> {
    const account = await tx.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('계좌를 찾을 수 없습니다.');
    }

    const transactions = await tx.transaction.findMany({
      where: {
        OR: [
          { accountId },
          { toAccountId: accountId }, // 입금용 transfer도 포함
        ],
      },
    });

    let newBalance = 0;

    for (const txItem of transactions) {
      const { type, amount } = txItem;

      if (type === 'income' && txItem.accountId === accountId) {
        newBalance += amount;
      } else if (type === 'expense' && txItem.accountId === accountId) {
        newBalance -= amount;
      } else if (type === 'transfer') {
        if (txItem.accountId === accountId && txItem.toAccountId) {
          // 출금 → 마이너스
          newBalance -= amount;
        } else if (txItem.toAccountId === accountId) {
          // 입금 → 플러스
          newBalance += amount;
        }
      }
    }

    // ✅ DB에 최신 balance 반영
    await tx.account.update({
      where: { id: accountId },
      data: { balance: newBalance },
    });

    return newBalance;
  }
}
