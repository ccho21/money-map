import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getUserTimezone } from '@/libs/timezone';
import {
  getDateRangeAndLabelByGroup,
  getUTCEndDate,
  getUTCStartDate,
  getValidDay,
  toUTC,
} from '@/libs/date.util';
import {
  AccountDashboardItemDTO,
  AccountDashboardDTO,
} from '@/accounts/dto/account-dashboard.dto';
import { toZonedTime } from 'date-fns-tz';
import { format, subMonths } from 'date-fns';
import { TransactionType } from '@prisma/client';
import { DateQueryDTO } from '@/common/dto/filter/date-query.dto';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { recalculateAccountBalanceInTx } from '@/transactions/utils/recalculateAccountBalanceInTx.util';
import { TransactionDetailDTO } from '@/transactions/dto/transaction-detail.dto';
import { TransactionGroupSummaryDTO } from '@/transactions/dto/transaction-group-summary.dto';
import { getTransactionDeltaByAccount } from '@/transactions/utils/getTransactionDeltaByAccount.util';
import { AccountTransactionSummaryDTO } from './dto/account-transaction-summary.dto';

import {
  AccountCreateRequestDTO,
  AccountUpdateRequestDTO,
} from './dto/account-request.dto';
import { AccountTransactionItemDTO } from './dto/account-transaction-item.dto';
import { GroupBy } from '@/common/types/types';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: AccountCreateRequestDTO) {
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
            date: now, // 타임존 기반 UTC
            note: 'Opening Balance',
            description: 'Account created with initial balance',
            isOpening: true,
          },
        });
      }

      // ✅ 계좌 잔액 재계산
      await recalculateAccountBalanceInTx(tx, account.id, userId);

      return account;
    });
  }

  async update(
    userId: string,
    accountId: string,
    dto: AccountUpdateRequestDTO,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');

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

    // ✅ 계좌 메타 정보 업데이트 (balance 제외)
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        color: dto.color ?? '#2196F3',
        settlementDate,
        paymentDate,
        autoPayment,
      },
    });

    // ✅ Opening 트랜잭션이 있다면 금액만 업데이트
    if (dto.balance !== undefined) {
      const openingTx = await this.prisma.transaction.findFirst({
        where: {
          accountId,
          isOpening: true,
        },
      });

      if (openingTx) {
        await this.prisma.transaction.update({
          where: { id: openingTx.id },
          data: {
            amount: Number(dto.balance),
          },
        });
      } else if (Number(dto.balance) > 0) {
        // ✅ 없는데 초기 금액이 있다면 새로 생성
        await this.prisma.transaction.create({
          data: {
            userId,
            accountId,
            type: 'income',
            amount: Number(dto.balance),
            date: now,
            note: 'Opening Balance',
            description: 'Account updated with initial balance',
            isOpening: true,
          },
        });
      }
    }

    // ✅ 항상 잔액 재계산
    await recalculateAccountBalanceInTx(this.prisma, accountId, userId);

    return updated;
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
  async getSummary(
    userId: string,
    { startDate, endDate, groupBy }: DateRangeWithGroupQueryDTO,
  ): Promise<AccountTransactionSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (!startDate || !endDate || !groupBy) {
      throw new BadRequestException(
        'startDate, endDate, groupBy are required.',
      );
    }

    const timezone = getUserTimezone(user);
    const from = getUTCStartDate(startDate, timezone);
    const to = getUTCEndDate(endDate, timezone);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: from,
          lte: to,
        },
      },
      select: {
        accountId: true,
        amount: true,
        type: true,
        date: true,
      },
    });

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        balance: true,
      },
    });

    // Create grouping buckets: accountId + groupKey → totals
    type SummaryBucket = {
      incomeTotal: number;
      expenseTotal: number;
      rangeStart: string;
      rangeEnd: string;
    };

    const summaryMap = new Map<string, SummaryBucket>();

    for (const tx of transactions) {
      const zoned = toZonedTime(tx.date, timezone);
      const { rangeStart, rangeEnd } = getDateRangeAndLabelByGroup(
        zoned,
        groupBy,
        timezone,
      );

      const compositeKey = `${tx.accountId}`;
      if (!summaryMap.has(compositeKey)) {
        summaryMap.set(compositeKey, {
          incomeTotal: 0,
          expenseTotal: 0,
          rangeStart: format(rangeStart, 'yyyy-MM-dd'),
          rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
        });
      }

      const summary = summaryMap.get(compositeKey)!;
      if (tx.type === 'income') {
        summary.incomeTotal += tx.amount;
      } else if (tx.type === 'expense') {
        summary.expenseTotal += tx.amount;
      }
    }

    const result: AccountTransactionItemDTO[] = [];

    for (const account of accounts) {
      const keys = Array.from(summaryMap.keys()).filter((k) =>
        k.startsWith(account.id),
      );
      if (keys.length === 0) {
        // No transactions, still return empty summary
        result.push({
          label: groupBy,
          accountId: account.id,
          accountName: account.name,
          balance: account.balance,
          incomeTotal: 0,
          expenseTotal: 0,
          rangeStart: format(from, 'yyyy-MM-dd'),
          rangeEnd: format(to, 'yyyy-MM-dd'),
        });
      } else {
        for (const key of keys) {
          const summary = summaryMap.get(key)!;
          result.push({
            label: groupBy,
            accountId: account.id,
            accountName: account.name,
            balance: account.balance,
            incomeTotal: summary.incomeTotal,
            expenseTotal: summary.expenseTotal,
            rangeStart: summary.rangeStart,
            rangeEnd: summary.rangeEnd,
          });
        }
      }
    }

    return {
      startDate: startDate,
      endDate: endDate,
      groupBy: groupBy,
      data: result,
    };
  }

  async getGroupedTransactions(
    userId: string,
    query: DateQueryDTO,
  ): Promise<AccountTransactionSummaryDTO> {
    const { startDate, endDate } = query;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const startUTC = getUTCStartDate(startDate, timezone);
    const endUTC = getUTCStartDate(endDate, timezone);

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const results: AccountTransactionItemDTO[] = [];

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

      const txDtos: TransactionDetailDTO[] = transactions.map((tx) => ({
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
        label: '',
        rangeStart: '',
        rangeEnd: '',
        accountId: account.id,
        accountName: account.name,
        balance: account.balance,
        incomeTotal,
        expenseTotal,
        transactions: txDtos,
      });
    }

    return {
      startDate: startDate,
      endDate: endDate,
      groupBy: 'monthly' as GroupBy,
      data: results,
    };
  }

  async getAccountsDashboard(userId: string): Promise<AccountDashboardDTO> {
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

        const response: AccountDashboardDTO = {
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
            settlementDate: account.settlementDate || account.settlementDate,
            paymentDate: account.settlementDate || account.settlementDate,
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
                (sum, tx) => sum + getTransactionDeltaByAccount(tx, account.id),
                0,
              );

            // ✅ 정산 이후 ~ 현재까지
            const outstandingBalance = cardTxs
              .filter((t) => t.date > settleEnd && t.date <= nowUTC)
              .reduce(
                (sum, tx) => sum + getTransactionDeltaByAccount(tx, account.id),
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

  async getAccountSummary(
    accountId: string,
    userId: string,
    filter: DateRangeWithGroupQueryDTO,
  ): Promise<TransactionGroupSummaryDTO> {
    const { startDate, endDate, groupBy } = filter;

    // 1️⃣ 유저 확인 및 타임존 설정
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const timezone = getUserTimezone(user);
    const utcStart = getUTCStartDate(startDate, timezone);
    const utcEnd = getUTCEndDate(endDate, timezone);

    // 2️⃣ 관련 트랜잭션 조회 (transfer 제외 조건 포함)
    const allTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        date: { gte: utcStart, lte: utcEnd },
        OR: [
          { type: TransactionType.income },
          { type: TransactionType.expense },
          { type: TransactionType.transfer },
        ],
      },
      orderBy: { date: 'asc' },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    // 3️⃣ transfer 중 toAccountId === null (입금) 제거
    const filteredTx = allTx.filter(
      (tx) => tx.type !== TransactionType.transfer || tx.toAccountId !== null,
    );

    // 4️⃣ 그룹별로 트랜잭션 분류
    const grouped = new Map<
      string,
      {
        rangeStart: string;
        rangeEnd: string;
        transactions: TransactionGroupSummaryDTO['data'][number]['transactions'];
      }
    >();

    for (const tx of filteredTx) {
      const { label, rangeStart, rangeEnd } = getDateRangeAndLabelByGroup(
        tx.date,
        groupBy,
        timezone,
      );

      if (!grouped.has(label)) {
        grouped.set(label, {
          rangeStart: format(rangeStart, 'yyyy-MM-dd'),
          rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
          transactions: [],
        });
      }

      grouped.get(label)!.transactions.push({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        note: tx.note ?? '',
        description: tx.description ?? '',
        accountId: tx.accountId,
        toAccountId: tx.toAccountId ?? undefined,
        linkedTransferId: tx.linkedTransferId ?? undefined,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        category: tx.category
          ? {
              id: tx.category.id,
              name: tx.category.name,
              icon: tx.category.icon,
              type: tx.category.type,
              color: tx.category.color ?? '',
            }
          : undefined,
        account: {
          id: tx.account.id,
          name: tx.account.name,
          type: tx.account.type,
          color: tx.account.color ?? undefined,
        },
        toAccount: tx.toAccount
          ? {
              id: tx.toAccount.id,
              name: tx.toAccount.name,
              type: tx.toAccount.type,
              color: tx.toAccount.color ?? undefined,
            }
          : undefined,
      });
    }

    // 5️⃣ 그룹 요약 데이터 계산
    const data: TransactionGroupSummaryDTO['data'] = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const [label, { rangeStart, rangeEnd, transactions }] of grouped) {
      const income = transactions
        .filter((t) => t.type === TransactionType.income)
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = transactions
        .filter((t) => t.type === TransactionType.expense)
        .reduce((sum, t) => sum + t.amount, 0);

      totalIncome += income;
      totalExpense += expense;

      data.push({
        label,
        rangeStart,
        rangeEnd,
        groupIncome: income,
        groupExpense: expense,
        transactions,
      });
    }

    // 6️⃣ 최종 결과 반환
    return {
      groupBy: groupBy,
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      data,
    };
  }
}
