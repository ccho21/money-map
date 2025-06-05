import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { Prisma, RecurringTransaction, Transaction } from '@prisma/client';

import { addMonths, format, isAfter, startOfMonth } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

import { getUserTimezone } from '@/libs/timezone';
import {
  getPreviousPeriod,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { recalculateAccountBalanceInTx } from './utils/recalculateAccountBalanceInTx.util';
import { TransactionCalendarDTO } from './dto/transactions/transaction-calendar.dto';
import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';
import { TransactionGroupListResponseDTO } from './dto/transactions/transaction-group-list-response.dto';
import { TransactionItemDTO } from './dto/transactions/transaction-item.dto';
import { TransactionGroupItemDTO } from './dto/transactions/transaction-group-item.dto';
import { TransactionGroupSummaryDTO } from './dto/summary/transaction-group-summary.dto';
import { TransactionChartFlowDTO } from './dto/charts/transaction-chart-flow.dto';

import {
  CategoryComparisonDTO,
  CategorySpendingDTO,
  TransactionChartCategoryDTO,
} from './dto/charts/transaction-chart-category.dto';
import {
  BudgetUsageDTO,
  TransactionChartBudgetDTO,
} from './dto/charts/transaction-chart-budget.dto';
// import { ChartFlowInsightService } from '@/insights/services/chart-flow-insight.service';
import { CategoryDetailDTO } from '@/categories/dto/category-detail.dto';
import { AccountDetailDTO } from '@/accounts/dto/account-detail.dto';
import { TransactionChartAccountDTO } from './dto/charts/transaction-chart-account.dto';
import { TransactionDetailDTO } from './dto/transactions/transaction-detail.dto';
import { CreateTransactionDTO } from './dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from './dto/transactions/transaction-update.dto';

export type TransactionFilterWhereInput = Prisma.TransactionWhereInput;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    // private readonly chartFlowInsightService: ChartFlowInsightService,
  ) {}

  private async resolveDateRange(
    userId: string,
    query: TransactionGroupQueryDTO,
    timezone: string,
  ): Promise<{ start: Date; end: Date }> {
    if (query.timeframe === 'all') {
      const range = await this.prisma.transaction.aggregate({
        where: { userId },
        _min: { date: true },
        _max: { date: true },
      });

      const start =
        range._min.date ?? getUTCStartDate(query.startDate, timezone);
      const end =
        range._max.date ??
        getUTCEndDate(query.endDate ?? query.startDate, timezone);

      return { start, end };
    }

    const start = getUTCStartDate(query.startDate, timezone);
    const end = getUTCEndDate(query.endDate ?? query.startDate, timezone);
    return { start, end };
  }

  async create(userId: string, dto: CreateTransactionDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId as string },
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException('계좌를 찾을 수 없습니다.');
    }

    let recurring: RecurringTransaction | null = null;

    // ✅ 먼저 RecurringTransaction을 생성 (있다면)
    if (dto.recurring?.frequency && dto.recurring?.startDate) {
      recurring = await this.prisma.recurringTransaction.create({
        data: {
          userId,
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId ?? null,
          note: dto.note,
          description: dto.description,
          frequency: dto.recurring.frequency,
          interval: dto.recurring.interval,
          startDate: new Date(dto.recurring.startDate),
          endDate: dto.recurring.endDate
            ? new Date(dto.recurring.endDate)
            : null,
        },
      });
    }

    // ✅ 트랜잭션 생성 (recurringTransactionId 연결 포함)
    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId ?? null,
          note: dto.note,
          description: dto.description,
          date: dto.date,
          userId,
          recurringTransactionId: recurring?.id ?? null,
        },
      });

      await recalculateAccountBalanceInTx(tx, dto.accountId, userId);
      return created;
    });

    // ✅ 예산 초과 알림
    if (dto.categoryId && dto.date) {
      const categoryId = dto.categoryId;
      const date = new Date(dto.date);
      await this.checkAndEmitBudgetAlert(userId, categoryId, date);
    }

    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDTO) {
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('거래를 찾을 수 없습니다.');
    }

    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // ✅ 업데이트를 실행하며 recurringTransactionId도 변경 가능
    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.categoryId && { categoryId: dto.categoryId }),
          ...(dto.accountId && { accountId: dto.accountId }),
          ...(dto.date && { date: dto.date }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      const promises = [
        recalculateAccountBalanceInTx(tx, existing.accountId, userId),
      ];
      if (dto.accountId && dto.accountId !== existing.accountId) {
        promises.push(recalculateAccountBalanceInTx(tx, dto.accountId, userId));
      }
      await Promise.all(promises);

      return updated;
    });

    // ✅ 기존 recurringTransaction 연결 여부 확인
    const existingRecurringId = existing.recurringTransactionId;

    // 🔻 recurring 삭제 요청 (기존 연결이 있는데, dto.recurring이 없음)
    if (!dto.recurring && existingRecurringId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: existingRecurringId },
      });

      await this.prisma.transaction.update({
        where: { id },
        data: { recurringTransactionId: null },
      });
    }

    // 🔄 recurring 생성/업데이트
    if (dto.recurring) {
      const recurringData = {
        userId,
        type: dto.type ?? existing.type,
        amount: dto.amount ?? existing.amount,
        categoryId: dto.categoryId ?? existing.categoryId,
        accountId: dto.accountId ?? existing.accountId,
        toAccountId: dto.toAccountId ?? null,
        note: dto.note ?? existing.note,
        description: dto.description ?? existing.description,
        frequency: dto.recurring.frequency,
        interval: dto.recurring.interval,
        startDate: new Date(dto.recurring.startDate),
        endDate: dto.recurring.endDate ? new Date(dto.recurring.endDate) : null,
      };

      if (existingRecurringId) {
        await this.prisma.recurringTransaction.update({
          where: { id: existingRecurringId },
          data: recurringData,
        });
      } else {
        const newRecurring = await this.prisma.recurringTransaction.create({
          data: recurringData,
        });

        await this.prisma.transaction.update({
          where: { id },
          data: { recurringTransactionId: newRecurring.id },
        });
      }
    }

    // ✅ 예산 초과 알림 로직 추가
    const categoryId = dto.categoryId ?? existing.categoryId;
    const rawDate = dto.date ?? existing.date;
    if (!categoryId) {
      throw new BadRequestException('Category ID is required.');
    }
    if (!rawDate) {
      throw new BadRequestException('Transaction date is required.');
    }
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    await this.checkAndEmitBudgetAlert(userId, categoryId, date);

    return updatedTransaction;
  }

  async delete(userId: string, id: string): Promise<{ message: string }> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('거래를 찾을 수 없습니다.');
    }

    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 삭제
      await tx.transaction.delete({
        where: { id },
      });

      // ✅ 잔액 재계산
      await recalculateAccountBalanceInTx(tx, existing.accountId, userId);

      // ✅ transfer라면 입금 계좌도 재계산
      if (existing.type === 'transfer' && existing.toAccountId) {
        await recalculateAccountBalanceInTx(tx, existing.toAccountId, userId);
      }
    });

    // ✅ 연결된 recurring 삭제
    if (existing.recurringTransactionId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: existing.recurringTransactionId },
      });
    }

    return { message: '삭제 완료' };
  }

  async getTransactionById(
    userId: string,
    transactionId: string,
  ): Promise<TransactionDetailDTO> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    if (!tx || tx.userId !== userId)
      throw new ForbiddenException('Access denied');

    const transactionDetailDTO: TransactionDetailDTO = {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      linkedTransferId: tx.linkedTransferId ?? null,
      date: tx.date.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      note: tx.note ?? null,
      description: tx.description ?? null,
      dueDate: tx.dueDate?.toISOString() ?? null,
      paidAt: tx.paidAt?.toISOString() ?? null,

      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            color: tx.category.color,
            type: tx.category.type,
          }
        : null,

      account: {
        id: tx.account.id,
        name: tx.account.name,
        type: tx.account.type,
        color: tx.account.color ?? null,
        balance: tx.account.balance,
      },

      toAccount: tx.toAccount
        ? {
            id: tx.toAccount.id,
            name: tx.toAccount.name,
            type: tx.toAccount.type,
            balance: tx.account.balance,
            color: tx.toAccount.color ?? null,
          }
        : null,
    };

    return transactionDetailDTO;
  }

  async getTransactionCalendarView(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionCalendarDTO[]> {
    const { timeframe } = query;

    // 1️⃣ 사용자 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    if (timeframe !== 'monthly') {
      throw new BadRequestException('timeframe should be monthly or weekly');
    }

    const timezone = getUserTimezone(user) ?? 'UTC';
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 2️⃣ Prisma groupBy로 일자 + 타입 단위 집계
    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: { amount: true },
    });

    // 3️⃣ Local 날짜 기준 재집계
    const map = new Map<string, { income: number; expense: number }>();

    for (const g of grouped) {
      const local = toZonedTime(g.date, timezone);
      const key = format(local, 'yyyy-MM-dd');

      const item = map.get(key) ?? { income: 0, expense: 0 };

      if (g.type === 'income') item.income += g._sum.amount ?? 0;
      if (g.type === 'expense') item.expense += g._sum.amount ?? 0;

      map.set(key, item);
    }

    console.log('## MA', map);
    // 4️⃣ DTO 변환 및 정렬 (선택)
    return Array.from(map.entries())
      .map(([date, value]) => ({
        date,
        income: value.income,
        expense: value.expense,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // 날짜순 정렬 (옵션)
  }

  async createTransfer(userId: string, dto: CreateTransactionDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (!fromAccountId || !toAccountId) {
      throw new BadRequestException(
        'Transfer transaction requires both fromAccountId and toAccountId',
      );
    }

    if (fromAccountId === toAccountId) {
      throw new BadRequestException(
        'fromAccountId and toAccountId cannot be the same',
      );
    }

    try {
      let recurring: RecurringTransaction | null = null;

      // ✅ 먼저 recurring 생성 (필요할 경우)
      if (dto.recurring?.frequency && dto.recurring?.startDate) {
        recurring = await this.prisma.recurringTransaction.create({
          data: {
            userId,
            type: 'transfer',
            amount,
            accountId: fromAccountId,
            toAccountId: toAccountId,
            note,
            description,
            frequency: dto.recurring.frequency,
            interval: dto.recurring.interval,
            startDate: new Date(dto.recurring.startDate),
            endDate: dto.recurring.endDate
              ? new Date(dto.recurring.endDate)
              : null,
          },
        });
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // ✅ 계좌 확인
        const [fromAccount, toAccount] = await Promise.all([
          tx.account.findUnique({ where: { id: fromAccountId } }),
          tx.account.findUnique({ where: { id: toAccountId } }),
        ]);

        if (!fromAccount || !toAccount) {
          throw new NotFoundException(
            '출금 또는 입금 계좌를 찾을 수 없습니다.',
          );
        }

        if (fromAccount.userId !== userId || toAccount.userId !== userId) {
          throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
        }

        if (fromAccount.type !== 'CARD' && fromAccount.balance < amount) {
          throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
        }

        // ✅ 출금 트랜잭션 생성 (recurring 연결 포함)
        const outTx = await tx.transaction.create({
          data: {
            type: 'transfer',
            amount,
            userId,
            accountId: fromAccountId,
            toAccountId,
            date,
            note,
            description,
            recurringTransactionId: recurring?.id ?? null,
          },
        });

        // ✅ 입금 트랜잭션 생성
        const inTx = await tx.transaction.create({
          data: {
            type: 'transfer',
            amount,
            userId,
            accountId: toAccountId,
            toAccountId: null,
            linkedTransferId: outTx.id,
            date,
            note,
            description,
          },
        });

        // ✅ 출금 트랜잭션 ↔ 입금 트랜잭션 연결
        await tx.transaction.update({
          where: { id: outTx.id },
          data: { linkedTransferId: inTx.id },
        });

        // ✅ 잔액 재계산
        await Promise.all([
          recalculateAccountBalanceInTx(tx, fromAccountId, userId),
          recalculateAccountBalanceInTx(tx, toAccountId, userId),
        ]);

        return { outgoing: outTx, incoming: inTx };
      });

      return result;
    } catch (err) {
      this.logger.error('❌ createTransfer 실패:', err);
      throw new InternalServerErrorException('이체 중 오류가 발생했습니다.');
    }
  }

  async updateTransfer(userId: string, id: string, dto: UpdateTransactionDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (!fromAccountId || !toAccountId) {
      throw new BadRequestException(
        'Transfer transaction requires both fromAccountId and toAccountId',
      );
    }

    if (fromAccountId === toAccountId) {
      throw new BadRequestException(
        'fromAccountId and toAccountId cannot be the same',
      );
    }

    const original = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!original || original.userId !== userId) {
      throw new NotFoundException('수정할 트랜잭션을 찾을 수 없습니다.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('계좌 정보를 찾을 수 없습니다.');
      }

      if (fromAccount.userId !== userId || toAccount.userId !== userId) {
        throw new ForbiddenException('본인의 계좌만 사용할 수 있습니다.');
      }

      const fromIsCard = fromAccount.type === 'CARD';
      if (!fromIsCard) {
        const simulated = fromAccount.balance + original.amount - (amount ?? 0);
        if (simulated < 0) {
          throw new BadRequestException('출금 계좌의 잔액이 부족합니다.');
        }
      }

      // 기존 입금 트랜잭션 제거
      if (original.type === 'transfer' && original.linkedTransferId) {
        await tx.transaction.delete({
          where: { id: original.linkedTransferId },
        });
      }

      // 새 입금 트랜잭션 생성
      const incoming = await tx.transaction.create({
        data: {
          type: 'transfer',
          userId,
          amount: amount ?? 0,
          accountId: toAccountId,
          toAccountId: null,
          linkedTransferId: original.id,
          date: date ?? new Date(),
          note,
          description,
        },
      });

      // 기존 출금 트랜잭션 업데이트
      const outgoing = await tx.transaction.update({
        where: { id },
        data: {
          type: 'transfer',
          amount,
          accountId: fromAccountId,
          toAccountId,
          linkedTransferId: incoming.id,
          date,
          note,
          description,
          categoryId: null,
        },
      });

      await Promise.all([
        recalculateAccountBalanceInTx(tx, fromAccountId, userId),
        recalculateAccountBalanceInTx(tx, toAccountId, userId),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });

    // ✅ Recurring 처리
    const existingRecurringId = original.recurringTransactionId;

    // ❌ 삭제 요청: dto.recurring이 없고, 기존에 연결되어 있음
    if (!dto.recurring && existingRecurringId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: existingRecurringId },
      });

      await this.prisma.transaction.update({
        where: { id },
        data: { recurringTransactionId: null },
      });
    }

    // 🔄 생성 또는 업데이트
    if (dto.recurring) {
      const recurringData = {
        userId,
        type: 'transfer' as const,
        amount: amount ?? original.amount,
        accountId: fromAccountId,
        toAccountId,
        note: note ?? original.note,
        description: description ?? original.description,
        frequency: dto.recurring.frequency,
        interval: dto.recurring.interval,
        startDate: new Date(dto.recurring.startDate),
        endDate: dto.recurring.endDate ? new Date(dto.recurring.endDate) : null,
      };

      if (existingRecurringId) {
        await this.prisma.recurringTransaction.update({
          where: { id: existingRecurringId },
          data: recurringData,
        });
      } else {
        const newRecurring = await this.prisma.recurringTransaction.create({
          data: recurringData,
        });

        await this.prisma.transaction.update({
          where: { id },
          data: { recurringTransactionId: newRecurring.id },
        });
      }
    }

    return result;
  }

  async deleteTransfer(userId: string, id: string) {
    const outgoing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (
      !outgoing ||
      outgoing.type !== 'transfer' ||
      outgoing.userId !== userId
    ) {
      throw new NotFoundException('삭제할 트랜잭션을 찾을 수 없습니다.');
    }

    const incoming = await this.prisma.transaction.findUnique({
      where: { id: outgoing.linkedTransferId ?? undefined },
      include: { account: true },
    });

    if (!incoming) {
      throw new NotFoundException('연결된 입금 트랜잭션을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 삭제
      await tx.transaction.deleteMany({
        where: {
          id: { in: [outgoing.id, incoming.id] },
        },
      });

      // ✅ 잔액 재계산
      await Promise.all([
        recalculateAccountBalanceInTx(tx, outgoing.accountId, userId),
        recalculateAccountBalanceInTx(tx, incoming.accountId, userId),
      ]);
    });

    // ✅ RecurringTransaction 연결이 있으면 삭제
    if (outgoing.recurringTransactionId) {
      await this.prisma.recurringTransaction.delete({
        where: { id: outgoing.recurringTransactionId },
      });
    }

    return { success: true };
  }

  async recalculateAccountBalance(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('계좌를 찾을 수 없습니다.');

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [
          { accountId },
          { toAccountId: accountId }, // 카드 입금 고려
        ],
      },
    });

    let newBalance = 0;

    for (const tx of transactions) {
      if (tx.type === 'income' && tx.accountId === accountId) {
        newBalance += tx.amount;
      } else if (tx.type === 'expense' && tx.accountId === accountId) {
        newBalance -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId && tx.toAccountId) {
          // 출금
          newBalance -= tx.amount;
        } else if (tx.toAccountId === accountId) {
          // 입금
          newBalance += tx.amount;
        }
      }
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { balance: newBalance },
    });

    return newBalance;
  }

  convertToTransactionDetailDTO = (
    tx: Transaction & {
      category?: CategoryDetailDTO;
      account: AccountDetailDTO;
      toAccount?: AccountDetailDTO | null;
    },
  ): TransactionDetailDTO => {
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note ?? '',
      description: tx.description ?? '',
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? null,
      linkedTransferId: tx.linkedTransferId ?? null,
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
        balance: tx.account.balance,
        color: tx.account.color ?? null,
      },

      toAccount: tx.toAccount
        ? {
            id: tx.toAccount.id,
            name: tx.toAccount.name,
            type: tx.toAccount.type,
            balance: tx.toAccount.balance,
            color: tx.toAccount.color ?? null,
          }
        : undefined,
    };
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // services/transaction.service.ts
  async getRecommendedKeywords(
    userId: string,
    limit = 5,
    sampleSize = 100,
  ): Promise<string[]> {
    const recent = await this.prisma.transaction.findMany({
      where: { userId, note: { not: null } },
      select: { note: true },
      orderBy: { date: 'desc' },
      take: sampleSize,
    });

    const freq: Record<string, number> = {};
    for (const { note } of recent) {
      note!
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '') // 특수문자 제거(유니코드 지원)
        .split(/\s+/)
        .forEach((w) => {
          if (w.length < 3) return; // 3자 미만 제외
          freq[w] = (freq[w] ?? 0) + 1;
        });
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  async getGroupedTransactions(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionGroupListResponseDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const baseWhere: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: start, lte: end },
      ...(query.transactionType && { type: query.transactionType }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.accountId && {
        OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }],
      }),
      ...(query.note?.trim() && {
        note: {
          contains: query.note.trim(),
          mode: 'insensitive',
        },
      }),
    };

    // ✨ balanceAfter 누적 처리 준비
    let balanceMap: Map<string, number> | undefined;
    if (query.includeBalance && query.accountId) {
      // 조회 시작일 이전의 트랜잭션으로 initialBalance 계산
      const priorTxs = await this.prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { accountId: query.accountId },
            { toAccountId: query.accountId },
          ],
          date: { lt: start },
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      });

      const initialBalance = priorTxs.reduce((acc, tx) => {
        if (tx.accountId === query.accountId) {
          return acc - tx.amount; // 출금
        } else if (tx.toAccountId === query.accountId) {
          return acc + tx.amount; // 입금
        }
        return acc;
      }, 0);

      // 실제 조회 구간 내 트랜잭션 조회
      const txs = await this.prisma.transaction.findMany({
        where: {
          userId,
          OR: [
            { accountId: query.accountId },
            { toAccountId: query.accountId },
          ],
          date: { gte: start, lte: end },
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        include: { account: true },
      });

      balanceMap = this.accumulateBalanceAfter(txs, initialBalance);
    }

    switch (query.groupBy ?? 'date') {
      case 'date':
        return this.groupByDate(
          user.id,
          start,
          end,
          query,
          timezone,
          baseWhere,
          balanceMap,
        );
      case 'category':
        return this.groupByCategory(
          user.id,
          start,
          end,
          query,
          baseWhere,
          balanceMap,
        );
      case 'account':
        return this.groupByAccount(
          user.id,
          start,
          end,
          query,
          baseWhere,
          balanceMap,
        );
      default:
        throw new BadRequestException('지원하지 않는 groupBy 값입니다.');
    }
  }
  async getTransactionSummary(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionGroupSummaryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const whereClause: Prisma.TransactionWhereInput = {
      userId,
      date: { gte: start, lte: end },
      ...(query.transactionType && { type: query.transactionType }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.accountId && {
        OR: [{ accountId: query.accountId }, { toAccountId: query.accountId }],
      }),
      ...(query.note?.trim() && {
        note: {
          contains: query.note.trim(),
          mode: 'insensitive',
        },
      }),
    };

    const allTx = await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const transactions = allTx.filter((tx) =>
      tx.type === 'transfer' ? tx.toAccountId !== null : true,
    );

    const totalIncome = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalExpense = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const netBalance = totalIncome - totalExpense;

    type TopSpendingItem = {
      id: string;
      name: string;
      icon?: string;
      amount: number;
    };

    const groupMap = new Map<string, TopSpendingItem>();

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;

      let key = '';
      let name = '';
      let icon: string | undefined;

      if (query.groupBy === 'category' && tx.category) {
        key = tx.category.id;
        name = tx.category.name;
        icon = tx.category.icon;
      } else if (query.groupBy === 'account' && tx.account) {
        key = tx.account.id;
        name = tx.account.name;
      } else if (query.groupBy === 'date') {
        key = format(tx.date, 'yyyy-MM-dd');
        name = key;
      } else {
        continue;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, { id: key, name, icon, amount: 0 });
      }

      groupMap.get(key)!.amount += tx.amount;
    }

    const topSpending = [...groupMap.values()].sort(
      (a, b) => b.amount - a.amount,
    )[0];

    let comparison: { difference: number; percent: string } | undefined =
      undefined;

    if (query.timeframe !== 'custom' && query.timeframe !== 'all') {
      const prevRange = getPreviousPeriod(query.timeframe, start, end);

      const prevTx = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: prevRange.start, lte: prevRange.end },
          type: 'expense',
          ...(query.categoryId && { categoryId: query.categoryId }),
          ...(query.accountId && {
            OR: [
              { accountId: query.accountId },
              { toAccountId: query.accountId },
            ],
          }),
          ...(query.note?.trim() && {
            note: {
              contains: query.note.trim(),
              mode: 'insensitive',
            },
          }),
        },
      });

      const prevTotal = prevTx.reduce((sum, tx) => sum + tx.amount, 0);
      const difference = totalExpense - prevTotal;
      const percent = prevTotal
        ? ((difference / prevTotal) * 100).toFixed(1)
        : '0.0';
      comparison = { difference, percent };
    }

    return {
      totalIncome,
      totalExpense,
      netBalance,
      timeframe: query.timeframe,
      groupBy: query.groupBy,
      startDate: query.startDate,
      endDate: query.endDate,
      ...(comparison ? { comparison } : {}),
      ...(topSpending
        ? {
            topSpendingCategory: {
              categoryId: topSpending.id,
              name: topSpending.name,
              icon: topSpending.icon ?? '',
              amount: topSpending.amount,
              type: 'expense',
            },
          }
        : {}),
    };
  }

  async getChartFlow(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartFlowDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const allTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
      },
      orderBy: { date: 'asc' },
    });

    // 🔹 Step 1: 집계 대상 기간 구하기
    const getMonthPeriods = (start: Date, end: Date): string[] => {
      const result: string[] = [];
      let current = startOfMonth(start);
      while (!isAfter(current, end)) {
        result.push(format(current, 'yyyy-MM'));
        current = addMonths(current, 1);
      }
      return result;
    };

    const periodsList = getMonthPeriods(start, end);
    const grouped = new Map<string, { income: number; expense: number }>();

    for (const tx of allTx) {
      const zonedDate = toZonedTime(tx.date, timezone);
      const period = format(zonedDate, 'yyyy-MM');

      if (!grouped.has(period)) {
        grouped.set(period, { income: 0, expense: 0 });
      }

      if (tx.type === 'income') grouped.get(period)!.income += tx.amount;
      if (tx.type === 'expense') grouped.get(period)!.expense += tx.amount;
    }

    const periods = periodsList.map((period) => {
      const data = grouped.get(period) ?? { income: 0, expense: 0 };
      const saved = data.income - data.expense;
      const rate =
        data.income > 0 ? Math.round((saved / data.income) * 100) : 0;

      return {
        period,
        income: data.income,
        expense: data.expense,
        saved,
        rate,
      };
    });

    // 🔹 Step 2: 인사이트 생성
    // const rawInsights = this.chartFlowInsightService.generateInsights(periods); // 주입 필요
    // const sorted = rawInsights.sort(
    //   (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
    // );
    // const insights = sorted.slice(0, query.limit ?? 1);

    // 🔹 Step 3: 응답 객체 구성
    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      insights: [],
      periods,
    };
  }

  async getChartCategory(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartCategoryDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 현재 기간 트랜잭션
    const currentTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type: 'expense',
        categoryId: { not: null },
      },
      include: { category: true },
    });

    const groupByCategory = new Map<string, CategorySpendingDTO>();
    for (const tx of currentTx) {
      const { id, name, icon, type, color } = tx.category!;
      if (!groupByCategory.has(id)) {
        groupByCategory.set(id, {
          categoryId: id,
          name,
          icon,
          type,
          amount: 0,
          color: color ?? undefined,
        });
      }
      groupByCategory.get(id)!.amount += tx.amount;
    }

    const topCategories = [...groupByCategory.values()].sort(
      (a, b) => b.amount - a.amount,
    );

    // 전월 비교
    let comparison: CategoryComparisonDTO | undefined = undefined;

    if (query.timeframe !== 'custom' && query.timeframe !== 'all') {
      const prevRange = getPreviousPeriod(query.timeframe, start, end);
      const prevTx = await this.prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: prevRange.start, lte: prevRange.end },
          type: 'expense',
          categoryId: { not: null },
        },
        include: { category: true },
      });

      // 이전 기간 집계
      const prevMap = new Map<string, number>();
      for (const tx of prevTx) {
        const id = tx.category!.id;
        prevMap.set(id, (prevMap.get(id) ?? 0) + tx.amount);
      }

      // 가장 큰 증감률을 가진 카테고리 찾기
      let maxDelta = 0;
      let bestMatch: CategoryComparisonDTO | null = null;

      for (const current of topCategories) {
        const prevAmount = prevMap.get(current.categoryId) ?? 0;
        const delta = current.amount - prevAmount;
        const percent =
          prevAmount > 0 ? ((delta / prevAmount) * 100).toFixed(1) : '∞';

        if (Math.abs(delta) > Math.abs(maxDelta)) {
          maxDelta = delta;
          bestMatch = {
            categoryId: current.categoryId,
            name: current.name,
            current: current.amount,
            previous: prevAmount,
            difference: delta,
            percentChange: percent,
            trend: delta > 0 ? 'increase' : 'decrease',
          };
        }
      }

      if (bestMatch) comparison = bestMatch;
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      topCategories,
      comparison,
    };
  }

  async getChartAccount(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartAccountDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    const accounts = await this.prisma.account.findMany({
      where: { userId },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }],
      },
    });

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    let totalIncome = 0;
    let totalExpense = 0;
    let totalBalance = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        incomeMap.set(
          tx.accountId,
          (incomeMap.get(tx.accountId) ?? 0) + tx.amount,
        );
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
        expenseMap.set(
          tx.accountId,
          (expenseMap.get(tx.accountId) ?? 0) + tx.amount,
        );
      }
    }

    const accountsData = accounts
      .map((account) => {
        const income = incomeMap.get(account.id) ?? 0;
        const expense = expenseMap.get(account.id) ?? 0;
        const balance = account.balance;
        totalBalance += balance;

        return {
          accountId: account.id,
          name: account.name,
          type: account.type,
          income,
          expense,
          balance,
          incomePercent: 0, // 나중에 계산됨
          expensePercent: 0,
          balancePercent: 0,
          color: account.color ?? undefined,
        };
      })
      .sort((a, b) => b.expense - a.expense);

    for (const item of accountsData) {
      item.incomePercent =
        totalIncome > 0 ? Math.round((item.income / totalIncome) * 100) : 0;
      item.expensePercent =
        totalExpense > 0 ? Math.round((item.expense / totalExpense) * 100) : 0;
      item.balancePercent =
        totalBalance > 0 ? Math.round((item.balance / totalBalance) * 100) : 0;
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      accounts: accountsData,
      insights: [], // TODO: 인사이트 연동
    };
  }

  async getChartBudget(
    userId: string,
    query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartBudgetDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const timezone = getUserTimezone(user);
    const { start, end } = await this.resolveDateRange(
      user.id,
      query,
      timezone,
    );

    // 1. 예산 카테고리 조회 (기간 & 유저 기준)
    const budgetCategories = await this.prisma.budgetCategory.findMany({
      where: {
        budget: { userId },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        category: true,
      },
    });

    // 2. 트랜잭션 조회 (해당 기간 expense만)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        type: 'expense',
        categoryId: { not: null },
      },
      include: { category: true },
    });

    // 3. 트랜잭션 집계 (categoryId → used)
    const usedMap = new Map<string, number>();
    for (const tx of transactions) {
      const id = tx.categoryId!;
      usedMap.set(id, (usedMap.get(id) ?? 0) + tx.amount);
    }

    // 4. breakdown 생성
    const seenCategoryIds = new Set<string>();

    const breakdown: BudgetUsageDTO[] = budgetCategories.map((bc) => {
      const used = usedMap.get(bc.categoryId) ?? 0;
      const over = Math.max(0, used - bc.amount);
      const remaining = Math.max(0, bc.amount - used);
      seenCategoryIds.add(bc.categoryId);

      return {
        categoryId: bc.categoryId,
        name: bc.category.name,
        icon: bc.category.icon,
        type: bc.category.type,
        budget: bc.amount,
        used,
        over,
        remaining,
        color: bc.category.color ?? undefined,
      };
    });

    // 5. 미지정 예산 카테고리 처리
    for (const tx of transactions) {
      if (!seenCategoryIds.has(tx.categoryId!)) {
        const id = tx.categoryId!;
        const used = usedMap.get(id)!;

        breakdown.push({
          categoryId: id,
          name: tx.category!.name,
          icon: tx.category!.icon,
          type: tx.category!.type,
          budget: 0,
          used,
          over: used,
          remaining: 0,
        });
      }
    }

    breakdown.sort((a, b) => b.used - a.used);
    const filteredBreakdown = breakdown.filter((b) => b.budget > 0);
    const totalBudget = breakdown.reduce((sum, b) => sum + b.budget, 0);
    const totalUsed = breakdown.reduce((sum, b) => sum + b.used, 0);
    const usageRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;
    const overBudget = totalUsed > totalBudget;
    const overCategoryCount = breakdown.filter((b) => b.over > 0).length;

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate ?? query.startDate,
      totalBudget,
      totalUsed,
      usageRate: Math.round(usageRate),
      overBudget,
      overCategoryCount,
      breakdown: filteredBreakdown,
    };
  }

  async groupByDate(
    userId: string,
    start: Date,
    end: Date,
    query: TransactionGroupQueryDTO,
    timezone: string,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    const allTx = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'desc' },
      ...(query.limit && { take: Number(query.limit) }),
    });

    const grouped = new Map<string, TransactionItemDTO[]>();

    for (const tx of allTx) {
      const label = formatInTimeZone(tx.date, timezone, 'yyyy-MM-dd');
      if (!grouped.has(label)) grouped.set(label, []);

      const balanceAfter = balanceMap?.get(tx.id);
      grouped
        .get(label)!
        .push(this.convertToTransactionItemDTO(tx, balanceAfter));
    }

    const groups: TransactionGroupItemDTO[] = [];
    for (const [label, transactions] of grouped.entries()) {
      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      groups.push({
        groupBy: 'date',
        groupKey: label,
        totalAmount,
        transactions,
      });
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate,
      groupBy: 'date',
      groups,
    };
  }

  async groupByCategory(
    userId: string,
    start: Date,
    end: Date,
    query: TransactionGroupQueryDTO,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    const allTx = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, TransactionItemDTO[]>();

    for (const tx of allTx) {
      const category = tx.category?.name ?? 'Uncategorized';
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(this.convertToTransactionItemDTO(tx));
    }

    const groups: TransactionGroupItemDTO[] = [];
    for (const [categoryName, transactions] of grouped.entries()) {
      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      groups.push({
        groupBy: 'category',
        groupKey: categoryName,
        totalAmount,
        transactions,
      });
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate,
      groupBy: 'category',
      groups,
    };
  }

  async groupByAccount(
    userId: string,
    start: Date,
    end: Date,
    query: TransactionGroupQueryDTO,
    where: Prisma.TransactionWhereInput,
    balanceMap?: Map<string, number>,
  ): Promise<TransactionGroupListResponseDTO> {
    const allTx = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, TransactionItemDTO[]>();

    for (const tx of allTx) {
      const account = tx.account?.name ?? 'Unknown Account';
      if (!grouped.has(account)) grouped.set(account, []);
      grouped.get(account)!.push(this.convertToTransactionItemDTO(tx));
    }

    const groups: TransactionGroupItemDTO[] = [];
    for (const [accountName, transactions] of grouped.entries()) {
      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      groups.push({
        groupBy: 'account',
        groupKey: accountName,
        totalAmount,
        transactions,
      });
    }

    return {
      timeframe: query.timeframe,
      startDate: query.startDate,
      endDate: query.endDate,
      groupBy: 'account',
      groups,
    };
  }

  private convertToTransactionItemDTO = (
    tx: Transaction & {
      category?: {
        name: string;
        icon: string;
        color: string | null;
      } | null;
      account: { name: string };
    },
    balanceAfter?: number, // ✨ 추가
  ): TransactionItemDTO => {
    return {
      id: tx.id,
      note: tx.note,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      date: tx.date.toISOString(),
      payment: tx.account.name,
      recurringId: tx.recurringTransactionId,
      balanceAfter, // ✨ 추가
      category: tx.category
        ? {
            name: tx.category.name,
            icon: tx.category.icon,
            color: tx.category.color ?? '#d1d5db',
          }
        : {
            name: 'Uncategorized',
            icon: '',
            color: '#d1d5db',
          },
      account: {
        name: tx.account.name,
      },
    };
  };

  private async checkAndEmitBudgetAlert(
    userId: string,
    categoryId: string,
    date: Date,
  ) {
    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId,
        budget: { userId },
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (!budgetItem) return;

    const spent = await this.prisma.transaction.aggregate({
      where: {
        categoryId,
        userId,
        type: 'expense',
        date: { gte: budgetItem.startDate, lte: budgetItem.endDate },
      },
      _sum: { amount: true },
    });

    const totalSpent = spent._sum.amount ?? 0;

    if (totalSpent > budgetItem.amount) {
      // const exceed = totalSpent - budgetItem.amount;
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      this.eventsGateway.emitBudgetAlert(userId, {
        category: category?.name ?? 'Unknown',
        message: `You've exceeded your $${budgetItem.amount.toLocaleString()} budget for "${category?.name ?? 'Unknown'}". \n Total spent: $${totalSpent.toLocaleString()}.`,
      });
    }
  }

  private accumulateBalanceAfter(
    transactions: (Transaction & { account: { name: string } })[],
    initialBalance: number,
  ): Map<string, number> {
    const map = new Map<string, number>();
    let balance = initialBalance;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        balance += tx.amount;
      } else if (tx.type === 'expense') {
        balance -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.accountId && tx.toAccountId) {
          // 출금
          balance -= tx.accountId ? tx.amount : 0;
        }
      }

      map.set(tx.id, balance);
    }

    return map;
  }
}
