import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { Transaction, TransactionType } from '@prisma/client';
import { mockAccount, mockPrismaFactory, mockUser } from '@/mocks/mockHelpers';
import { randomUUID } from 'crypto';
import { TransactionsAnalysisService } from '../analysis.service';
import { BadRequestException } from '@nestjs/common';
import { DateRangeService } from '../date-range.service';

describe('TransactionsAnalysisService', () => {
  let service: TransactionsAnalysisService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsAnalysisService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        {
          provide: DateRangeService,
          useValue: {
            resolveDateRange: jest.fn().mockResolvedValue({
              start: new Date('2025-06-01T00:00:00Z'),
              end: new Date('2025-06-30T23:59:59Z'),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsAnalysisService>(
      TransactionsAnalysisService,
    );
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // describe('convertToTransactionDetailDTO', () => {
  //   it('maps entity fields to DTO', () => {
  //     const fullMockTx: Transaction & {
  //       category: CategoryDetailDTO;
  //       account: AccountDetailDTO;
  //       toAccount: AccountDetailDTO;
  //     } = {
  //       id: 'tx-001',
  //       userId: mockUser.id,
  //       createdAt: new Date(),
  //       deletedAt: null,
  //       type: 'expense' as TransactionType,
  //       description: 'desc',
  //       amount: 5000,
  //       categoryId: 'cat',
  //       accountId: 'acc-001',
  //       toAccountId: null,
  //       linkedTransferId: null,
  //       note: 'note',
  //       date: new Date(),
  //       recurringTransactionId: null,
  //       dueDate: null,
  //       paidAt: null,
  //       isOpening: false,

  //       category: {
  //         id: 'cat',
  //         name: 'Food',
  //         icon: '🍔',
  //         type: 'expense',
  //         color: '#f00',
  //       },
  //       account: {
  //         id: 'acc-001',
  //         name: 'Wallet',
  //         type: 'CASH',
  //         balance: 10000,
  //         color: '#000000',
  //       },
  //       toAccount: {
  //         id: 'acc-002',
  //         name: 'Bank',
  //         type: 'BANK',
  //         balance: 5000,
  //         color: '#00f',
  //       },
  //     };

  //     const dto: TransactionDetailDTO =
  //       service.convertToTransactionDetailDTO(fullMockTx);

  //     expect(dto.id).toBe(mockTransaction.id);
  //     expect(dto.account.id).toBe(mockAccount.id);
  //     expect(dto.toAccount?.id).toBe('acc-2');
  //     expect(dto.category?.name).toBe('Food');
  //   });
  // });
  ///////// getGroupedTransactions /////////
  describe('TransactionsAnalysisService - getGroupedTransactions()', () => {
    let service: TransactionsAnalysisService;
    let prisma: PrismaService;

    let userId: string;
    let accountId: string;
    let categoryId: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          TransactionsAnalysisService,
          PrismaService,
          DateRangeService,
        ],
      }).compile();

      service = moduleRef.get(TransactionsAnalysisService);
      dateRangeService = moduleRef.get(DateRangeService);
      prisma = moduleRef.get(PrismaService);

      const user = await prisma.user.create({
        data: {
          email: `test-${randomUUID()}@test.com`,
          password: 'hashed-password',
        },
      });
      userId = user.id;

      const category = await prisma.category.create({
        data: {
          name: '식비',
          type: 'expense',
          icon: '🍚',
          userId,
        },
      });
      categoryId = category.id;

      const account = await prisma.account.create({
        data: {
          name: '테스트 계좌',
          type: 'CASH',
          userId,
          balance: 0,
        },
      });
      accountId = account.id;

      const now = new Date();

      await prisma.transaction.createMany({
        data: [
          {
            userId,
            accountId,
            categoryId,
            type: 'expense',
            amount: 3000,
            date: now,
          },
          {
            userId,
            accountId,
            categoryId,
            type: 'expense',
            amount: 2000,
            date: now,
          },
          {
            userId,
            accountId,
            categoryId,
            type: 'income',
            amount: 10000,
            date: now,
          },
          {
            userId,
            accountId,
            categoryId,
            type: 'expense',
            amount: 1000,
            note: '커피',
            date: now,
          },
        ],
      });
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany(); // ✅ 1. 트랜잭션부터
      await prisma.recurringTransaction.deleteMany(); // ✅ 2. 반복 트랜잭션
      await prisma.budgetCategory.deleteMany(); // ✅ 3. FK를 먼저 제거해야 함
      await prisma.budget.deleteMany(); // ✅ 4. 예산 본체
      await prisma.account.deleteMany(); // ✅ 5. 계좌
      await prisma.category.deleteMany(); // ✅ 6. 카테고리 (이제 가능)
      await prisma.user.deleteMany(); // ✅ 7. 유저
    });

    it('should group transactions by date with correct totalAmount', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'monthly' as const,
        groupBy: 'date',
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'date',
      });

      const totalTransactions = result.groups.flatMap(
        (group) => group.transactions,
      ).length;
      expect(result).toBeDefined();
      const group = result;
      expect(result.groupBy).toBe('date');
      expect(totalTransactions).toBe(4);
      expect(
        result.groups.map((g) => g.totalAmount).reduce((a, b) => a + b),
      ).toBe(16000);
    });

    it('should group transactions by category', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'monthly' as const,
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'category',
      });
      const group = result.groups[0];
      expect(group.groupBy).toBe('category');
      expect(group.groupKey).toBe('식비');
      expect(group.transactions.length).toBe(4);
    });

    it('should group transactions by account', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'custom' as const,
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'account',
      });
      const group = result.groups[0];
      expect(group.groupBy).toBe('account');
      expect(group.groupKey).toBe('테스트 계좌');
      expect(group.transactions.length).toBe(4);
    });

    it('should filter by transactionType', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'custom' as const,
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'date',
        transactionType: 'expense',
      });
      expect(result.groups[0].transactions.length).toBe(3);
    });

    it('should filter by note keyword', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'custom' as const,
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'date',
        note: '커피',
      });
      expect(result.groups[0].transactions.length).toBe(1);
      expect(result.groups[0].transactions[0].note).toBe('커피');
    });

    it('should throw BadRequestException for unsupported groupBy value', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'custom' as const,
      };
      await expect(
        service.getGroupedTransactions(userId, {
          ...baseQuery,
          groupBy: 'invalid' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include balanceAfter when includeBalance is true', async () => {
      const [startDate, endDate] = getCurrentDateString();
      const baseQuery = {
        startDate,
        endDate,
        timeframe: 'custom' as const,
      };
      const result = await service.getGroupedTransactions(userId, {
        ...baseQuery,
        groupBy: 'date',
        accountId,
        includeBalance: true,
      });
      const tx = result.groups[0].transactions[0];
      expect(tx.balanceAfter).toBeDefined();
      expect(typeof tx.balanceAfter).toBe('number');
    });
  });

  describe('accumulateBalanceAfter', () => {
    it('returns running balances for given transactions', () => {
      const txs = [
        {
          id: 'a',
          type: 'income',
          amount: 10,
          accountId: mockAccount.id,
          toAccountId: null,
          account: { name: 'A' },
        },
        {
          id: 'b',
          type: 'expense',
          amount: 5,
          accountId: mockAccount.id,
          toAccountId: null,
          account: { name: 'A' },
        },
        {
          id: 'c',
          type: 'transfer',
          amount: 20,
          accountId: mockAccount.id,
          toAccountId: 'acc-2',
          account: { name: 'A' },
        },
      ];
      const map: Map<string, number> = service.accumulateBalanceAfter(txs, 0);
      expect(map.get('a')).toBe(10);
      expect(map.get('b')).toBe(5);
      expect(map.get('c')).toBe(-15);
    });
  });

  describe('getRecommendedKeywords', () => {
    it('extracts most frequent words from notes', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        { note: 'Coffee and Snacks' },
        { note: 'Coffee Beans' },
        { note: 'Buy Snacks' },
      ]);

      const words = await service.getRecommendedKeywords(mockUser.id);
      expect(words[0]).toBe('coffee');
      expect(words).toContain('snacks');
    });
  });

  describe('groupByDate', () => {
    it('groups transactions by local date', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          type: 'income' as TransactionType,
          amount: 20,
          date: new Date('2024-01-01T00:00:00Z'),
          note: null,
          description: null,
          account: { name: 'A' },
          category: null,
          toAccount: null,
        },
        {
          id: 't2',
          type: 'expense' as TransactionType,
          amount: 5,
          date: new Date('2024-01-01T12:00:00Z'),
          note: null,
          description: null,
          account: { name: 'A' },
          category: null,
          toAccount: null,
        },
      ]);

      const result = await service.groupByDate(
        {
          timeframe: 'daily',
          startDate: '2024-01-01',
          endDate: '2024-01-01',
          groupBy: 'date',
        },
        'UTC',
        {},
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groupKey).toBe('2024-01-01');
      expect(result.groups[0].totalAmount).toBe(25);
    });
  });

  describe('groupByCategory', () => {
    it('groups transactions by category name', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          type: 'expense' as TransactionType,
          amount: 10,
          date: new Date(),
          note: null,
          description: null,
          account: { name: 'A' },
          category: { name: 'Food', icon: '🍔', color: null },
          toAccount: null,
        },
        {
          id: 't2',
          type: 'expense' as TransactionType,
          amount: 20,
          date: new Date(),
          note: null,
          description: null,
          account: { name: 'A' },
          category: { name: 'Food', icon: '🍔', color: null },
          toAccount: null,
        },
      ]);

      const result = await service.groupByCategory(
        {
          timeframe: 'daily',
          startDate: '2024-01-01',
          endDate: '2024-01-01',
          groupBy: 'category',
        },
        {},
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groupKey).toBe('Food');
      expect(result.groups[0].totalAmount).toBe(30);
    });
  });

  describe('groupByAccount', () => {
    it('groups transactions by account name', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          type: 'expense' as TransactionType,
          amount: 5,
          date: new Date(),
          note: null,
          description: null,
          account: { name: 'Wallet' },
          category: null,
          toAccount: null,
        },
        {
          id: 't2',
          type: 'expense' as TransactionType,
          amount: 15,
          date: new Date(),
          note: null,
          description: null,
          account: { name: 'Wallet' },
          category: null,
          toAccount: null,
        },
      ]);

      const result = await service.groupByAccount(
        {
          timeframe: 'daily',
          startDate: '2024-01-01',
          endDate: '2024-01-01',
          groupBy: 'account',
        },
        {},
      );

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].groupKey).toBe('Wallet');
      expect(result.groups[0].totalAmount).toBe(20);
    });
  });
});

const getCurrentDateString = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const startDate = new Date(currentYear, currentMonth, 1)
    .toISOString()
    .slice(0, 10); // 'YYYY-MM-DD'

  const endDate = new Date(currentYear, currentMonth + 1, 0) // 마지막 날짜
    .toISOString()
    .slice(0, 10); // 'YYYY-MM-DD'

  return [startDate, endDate];
};
