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
  fromUTC,
  getDateRangeAndLabelByGroup,
  getLocalDate,
  getValidDay,
  toUTC,
} from '@/libs/date.util';
import {
  AccountDashboardItemDTO,
  AccountDashboardResponseDTO,
} from './dto/account-dashboard-response.dto';
import { TransactionType } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import { subMonths } from 'date-fns';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);
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

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        balance: Number(dto.balance), // 초기 값 입력은 OK
        description: dto.description ?? null,
        type: dto.type,
        color: dto.color ?? '#2196F3',
        settlementDate,
        paymentDate,
        autoPayment,
      },
    });

    return account;
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
    const now = fromUTC(new Date(), timezone);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // ✅ 계좌 + 트랜잭션 미리 조회 (한 번에)
        const [accounts, cardTransactions, unpaidExpenses] = await Promise.all([
          tx.account.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          }),
          tx.transaction.findMany({
            where: {
              userId,
              OR: [{ type: 'expense' }, { type: 'transfer' }],
              account: { type: 'CARD' },
            },
            select: {
              amount: true,
              type: true,
              accountId: true,
              toAccountId: true,
            },
          }),
          tx.transaction.findMany({
            where: {
              userId,
              type: 'expense',
              paidAt: null,
              account: { type: 'CARD' },
            },
            select: {
              amount: true,
              date: true,
              accountId: true,
            },
          }),
        ]);

        const result: AccountDashboardResponseDTO = {
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
            result.asset += account.balance;
          }

          // ✅ 카드 계좌는 트랜잭션 기준으로 부채 재계산
          let calculatedLiability = 0;
          if (isCard) {
            const relatedTxs = cardTransactions.filter(
              (t) => t.accountId === account.id || t.toAccountId === account.id,
            );

            for (const tx of relatedTxs) {
              if (tx.type === 'expense' && tx.accountId === account.id) {
                calculatedLiability += tx.amount; // 지출 → 부채 증가
              } else if (
                tx.type === 'transfer' &&
                tx.toAccountId === account.id
              ) {
                calculatedLiability -= tx.amount; // 갚음 → 부채 감소
              }
            }

            result.liability += calculatedLiability;
          }

          const base: AccountDashboardItemDTO = {
            id: account.id,
            name: account.name,
            type: account.type,
            financialType: accountType,
            amount: account.balance, // 실제 balance
          };

          // ✅ 카드 정산 정보
          if (isCard && account.settlementDate !== null) {
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const thisMonthSettleDay = getValidDay(
              year,
              month,
              account.settlementDate,
            );
            const settleEnd = new Date(year, month - 1, thisMonthSettleDay);

            const prevMonth = subMonths(now, 1);
            const prevSettleDay = getValidDay(
              prevMonth.getFullYear(),
              prevMonth.getMonth() + 1,
              account.settlementDate,
            );
            const settleStart = new Date(
              prevMonth.getFullYear(),
              prevMonth.getMonth(),
              prevSettleDay + 1,
            );

            const expenses = unpaidExpenses.filter(
              (t) => t.accountId === account.id,
            );
            const balancePayable = expenses
              .filter((t) => t.date >= settleStart && t.date <= settleEnd)
              .reduce((sum, t) => sum + t.amount, 0);

            Object.assign(base, {
              balancePayable,
              outstandingBalance: account.balance, // overpay 반영된 현재 상태
            });
          }

          result.data[account.type].push(base);
        }

        result.total = result.asset - result.liability;

        return result;
      });

      return result;
    } catch (err) {
      this.logger.error('getAccountsDashboard 실패', err);
      throw new Error('계좌 요약 정보를 불러오는 데 실패했습니다.');
    }
  }
}
