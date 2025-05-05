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
import { Prisma, Transaction, TransactionType } from '@prisma/client';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { getUserTimezone } from '@/libs/timezone';
import {
  TransactionCreateRequestDTO,
  TransactionUpdateRequestDTO,
  TransactionTransferRequestDTO,
} from '@/transactions/dto/transaction-request.dto';
import {
  getDateRangeAndLabelByGroup,
  getUTCEndDate,
  getUTCStartDate,
} from '@/libs/date.util';
import { DateRangeWithGroupQueryDTO } from '@/common/dto/filter/date-range-with-group-query.dto';
import { recalculateAccountBalanceInTx } from './utils/recalculateAccountBalanceInTx.util';
import { TransactionGroupSummaryDTO } from './dto/transaction-group-summary.dto';
import { TransactionDetailDTO } from './dto/transaction-detail.dto';
import { TransactionGroupItemDTO } from './dto/transaction-group-item.dto';
import { TransactionCalendarDTO } from './dto/transaction-calendar.dto';
import {
  TransactionCursorSummaryResponseDTO,
  TransactionSummaryCursorQueryDTO,
} from './dto/transaction-summary-cursor-query.dto';

export type TransactionFilterWhereInput = Prisma.TransactionWhereInput;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(userId: string, dto: TransactionCreateRequestDTO) {
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

    const transaction = await this.prisma.$transaction(async (tx) => {
      // ✅ 트랜잭션 생성
      const created = await tx.transaction.create({
        data: {
          type: dto.type,
          amount: dto.amount,
          categoryId: dto.categoryId,
          accountId: dto.accountId,
          note: dto.note,
          description: dto.description,
          date: dto.date,
          userId,
        },
      });

      // ✅ 계좌 잔액 재계산
      await recalculateAccountBalanceInTx(tx, dto.accountId, userId);

      return created;
    });

    // ✅ 예산 초과 경고는 트랜잭션 외부에서 처리
    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId: dto.categoryId as string,
        budget: { userId },
      },
    });

    if (budgetItem) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          categoryId: dto.categoryId,
          userId,
          type: 'expense',
        },
        _sum: { amount: true },
      });

      const totalSpent = spent._sum.amount || 0;
      if (totalSpent > budgetItem.amount) {
        const exceed = totalSpent - budgetItem.amount;
        this.eventsGateway.emitBudgetAlert(userId, {
          category: category.name,
          message: `예산 초과! ₩${exceed}`,
        });
      }
    }

    return transaction;
  }

  async update(userId: string, id: string, dto: TransactionUpdateRequestDTO) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('거래를 찾을 수 없습니다.');

    if (existing.isOpening) {
      throw new BadRequestException('Opening Balance는 삭제할 수 없습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

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

      // ✅ 잔액 재계산 (기존 계좌)
      await recalculateAccountBalanceInTx(tx, existing.accountId, userId);

      // ✅ transfer인 경우 입금 계좌도 재계산 필요
      if (existing.type === 'transfer' && existing.toAccountId) {
        await recalculateAccountBalanceInTx(tx, existing.toAccountId, userId);
      }
    });

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

  async getTransactionSummary(
    userId: string,
    query: DateRangeWithGroupQueryDTO,
  ): Promise<TransactionGroupSummaryDTO> {
    const { groupBy, startDate, endDate } = query;

    // 1️⃣ 유저 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    // 2️⃣ 해당 기간의 모든 트랜잭션 조회 (income/expense/transfer만)
    const allTx = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [{ type: 'income' }, { type: 'expense' }, { type: 'transfer' }],
      },
      orderBy: { date: 'asc' },
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    // 3️⃣ 트랜스퍼 중 입금 트랜잭션(toAccountId === null)은 제외
    const transactions = allTx.filter((tx) =>
      tx.type === 'transfer' ? tx.toAccountId !== null : true,
    );

    // 4️⃣ 그룹화 및 요약 데이터 생성
    const grouped = new Map<
      string,
      {
        rangeStart: string;
        rangeEnd: string;
        transactions: TransactionDetailDTO[];
      }
    >();

    for (const tx of transactions) {
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

      grouped
        .get(label)!
        .transactions.push(this.convertToTransactionDetailDTO(tx));
    }

    // 5️⃣ 요약 데이터 계산
    const items: TransactionGroupItemDTO[] = [];
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

      items.push({
        label,
        rangeStart,
        rangeEnd,
        groupIncome: income,
        groupExpense: expense,
        transactions,
      });
    }

    // 6️⃣ 결과 반환
    return {
      groupBy: groupBy,
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      items,
    };
  }

  async getTransactionSummaryByCursor(
    userId: string,
    query: TransactionSummaryCursorQueryDTO,
  ): Promise<TransactionCursorSummaryResponseDTO> {
    const { groupBy, cursorDate, cursorId, limit, startDate, endDate } = query;
  
    console.log('📥 [API 호출] getTransactionSummaryByCursor');
    console.log('▶ userId:', userId);
    console.log('▶ query:', query);
    if (!cursorDate || !cursorId) {
      console.log('⛔️ 커서 없음 → 더 이상 불러올 항목 없음');
      return { nextCursor: null, items: [] };
    }
  
    // 1️⃣ 유저 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');
    const timezone = getUserTimezone(user);
    console.log('🌐 timezone:', timezone);
  
    // 2️⃣ where 조건 구성
    const where: Prisma.TransactionWhereInput = {
      userId,
      OR: [
        { type: 'income' },
        { type: 'expense' },
        {
          type: 'transfer',
          toAccountId: { not: null }, // ✅ 여기서 transfer 필터링
        },
      ],
    };
  
    // 2-1️⃣ 날짜 범위 필터 (optional)
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = getUTCStartDate(startDate, timezone);
      if (endDate) where.date.lte = getUTCEndDate(endDate, timezone);
      console.log('🗓️ filter range:', where.date.gte, '~', where.date.lte);
    }
  
    // 2-2️⃣ 커서 조건
    if (cursorDate && cursorId) {
      console.log('🔖 cursorDate:', cursorDate);
      console.log('🔖 cursorId:', cursorId);
      where.OR = [
        { date: { lt: cursorDate } },
        {
          date: cursorDate,
          id: { lt: cursorId },
        },
      ];
    }
  
    // 3️⃣ 트랜잭션 조회
    const safeLimit = parseInt(String(limit), 10) || 20;
    const rawTx = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: safeLimit * 3, // ✅ 넉넉하게 fetch → 유효한 limit 보장
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });
  
    console.log(`📦 rawTx count: ${rawTx.length}`);
  
    // 4️⃣ 실제 사용할 유효 트랜잭션 (limit 개수만 슬라이스)
    const transactions = rawTx.slice(0, safeLimit);
    const lastTx = transactions.at(-1);
  
    const nextCursor = lastTx
      ? {
          date: lastTx.date.toISOString(),
          id: lastTx.id,
        }
      : null;
  
    console.log('⏭️ nextCursor:', nextCursor);
    console.log(`✅ 유효 트랜잭션 수: ${transactions.length}`);
  
    // 5️⃣ 그룹핑
    const grouped = new Map<
      string,
      { rangeStart: string; rangeEnd: string; transactions: TransactionDetailDTO[] }
    >();
  
    for (const tx of transactions) {
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
  
      grouped.get(label)!.transactions.push(this.convertToTransactionDetailDTO(tx));
    }
  
    console.log('📊 그룹핑 완료:', Array.from(grouped.keys()));
  
    // 6️⃣ 요약 계산
    const items: TransactionGroupItemDTO[] = [];
  
    for (const [label, { rangeStart, rangeEnd, transactions }] of grouped) {
      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
  
      const expense = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
  
      items.push({
        label,
        rangeStart,
        rangeEnd,
        groupIncome: income,
        groupExpense: expense,
        transactions,
      });
    }
  
    console.log('📈 최종 items 수:', items.length);
  
    return {
      nextCursor,
      items,
    };
  }
  
  

  async getTransactionCalendarView(
    userId: string,
    query: DateRangeWithGroupQueryDTO,
  ): Promise<TransactionCalendarDTO[]> {
    const { startDate, endDate } = query;

    // 1️⃣ 유저 인증 및 타임존 확보
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('사용자를 찾을 수 없습니다.');

    const timezone = getUserTimezone(user);
    const start = getUTCStartDate(startDate, timezone);
    const end = getUTCEndDate(endDate, timezone);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: { userId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    });

    const map = new Map<string, { income: number; expense: number }>();
    for (const g of grouped) {
      const local = toZonedTime(g.date, timezone);
      const key = format(local, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const item = map.get(key)!;
      if (g.type === 'income') item.income += g._sum.amount ?? 0;
      if (g.type === 'expense') item.expense += g._sum.amount ?? 0;
    }

    return Array.from(map.entries()).map(([date, value]) => ({
      date,
      income: value.income,
      expense: value.expense,
    }));
  }

  async createTransfer(userId: string, dto: TransactionTransferRequestDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌 간 이체는 허용되지 않습니다.');
    }

    try {
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

        // ✅ 트랜스퍼 생성
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
          },
        });

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

        await tx.transaction.update({
          where: { id: outTx.id },
          data: { linkedTransferId: inTx.id },
        });

        // ✅ 트랜잭션 후 잔액 재계산
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

  async updateTransfer(
    userId: string,
    id: string,
    dto: TransactionTransferRequestDTO,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const { amount, fromAccountId, toAccountId, date, note, description } = dto;

    if (fromAccountId === toAccountId) {
      throw new BadRequestException('같은 계좌로 이체할 수 없습니다.');
    }

    const original = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!original || original.userId !== userId) {
      throw new NotFoundException('수정할 트랜잭션을 찾을 수 없습니다.');
    }

    return await this.prisma.$transaction(async (tx) => {
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
        const simulated = fromAccount.balance + original.amount - amount;
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
          amount,
          accountId: toAccountId,
          toAccountId: null,
          linkedTransferId: original.id,
          date,
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
      console.log('### tx', incoming);
      console.log('### fromAccountId', outgoing);
      console.log('###toAccountId', toAccountId);

      // ✅ 잔액 재계산
      await Promise.all([
        recalculateAccountBalanceInTx(tx, fromAccountId, userId),
        recalculateAccountBalanceInTx(tx, toAccountId, userId),
      ]);

      return { updatedOutgoing: outgoing, updatedIncoming: incoming };
    });
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
      category?: any;
      account: any;
      toAccount?: any | null;
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
}
