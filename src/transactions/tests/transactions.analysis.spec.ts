import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionsAnalysisService } from '../analysis.service';
import { DateRangeService } from '../date-range.service';
import {
  mockPrismaFactory,
  mockTransaction,
  mockUser,
  TransactionDetail,
} from '@/mocks/mockHelpers';
import { TransactionType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { TransactionGroupQueryDTO } from '../dto/params/transaction-group-query.dto';

describe('TransactionsAnalysisService (unit)', () => {
  let service: TransactionsAnalysisService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
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

    service = module.get(TransactionsAnalysisService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('accumulateBalanceAfter', () => {
    it('calculates running balances correctly', () => {
      const txs = [
        {
          ...mockTransaction,
          id: 'tx-001',
          type: TransactionType.income,
          amount: 10,
          accountId: 'acc-001',
          toAccountId: null,
          account: { name: 'Account A' },
        },
        {
          ...mockTransaction,
          id: 'tx-002',
          type: TransactionType.expense,
          amount: 5,
          accountId: 'acc-001',
          toAccountId: null,
          account: { name: 'Account A' },
        },
        {
          ...mockTransaction,
          id: 'tx-003',
          type: TransactionType.transfer,
          amount: 3,
          accountId: 'acc-001',
          toAccountId: 'acc-002',
          account: { name: 'Account A' },
        },
      ];

      const result = service.accumulateBalanceAfter(txs, 0); // you can refine the typing if needed

      expect(result.get('tx-001')).toBe(10); // income +10
      expect(result.get('tx-002')).toBe(5); // -5 = 10 - 5
      expect(result.get('tx-003')).toBe(2); // -3 = 5 - 3
    });
  });

  describe('groupByDate', () => {
    it('groups transactions by date string', async () => {
      const fixedDate = new Date('2025-06-15');

      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
        {
          ...mockTransaction,
          id: 't1',
          type: TransactionType.income,
          amount: 5,
          date: fixedDate,
          account: { name: 'A' },
          category: null,
          toAccount: null,
        },
        {
          ...mockTransaction,
          id: 't2',
          type: TransactionType.expense,
          amount: 3,
          date: fixedDate,
          account: { name: 'A' },
          category: null,
          toAccount: null,
        },
      ] as TransactionDetail[]);

      const result = await service.groupByDate(
        {
          timeframe: 'daily',
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          groupBy: 'date',
        },
        'UTC',
        {},
      );

      expect(result.groups[0].groupKey).toBe('2025-06-15');
      expect(result.groups[0].totalAmount).toBe(8);
    });
  });

  describe('groupByCategory', () => {
    it('groups by category name', async () => {
      const fixedDate = new Date('2025-06-15');

      const transactions: TransactionDetail[] = [
        {
          id: 't1',
          type: TransactionType.expense,
          amount: 5,
          date: fixedDate,
          note: null,
          description: null,
          accountId: 'acc-001',
          userId: 'user-id-123',
          categoryId: 'cat-001',
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          account: { name: 'A' },
          category: {
            id: 'cat-001',
            name: 'Food',
            icon: '🍔',
            color: null,
            type: 'expense',
            userId: 'user-id-123',
          },
          toAccount: null,
        },
        {
          id: 't2',
          type: TransactionType.expense,
          amount: 5,
          date: fixedDate,
          note: null,
          description: null,
          accountId: 'acc-001',
          userId: 'user-id-123',
          categoryId: 'cat-001',
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          account: { name: 'A' },
          category: {
            id: 'cat-001',
            name: 'Food',
            icon: '🍔',
            color: null,
            type: 'expense',
            userId: 'user-id-123',
          },
          toAccount: null,
        },
      ];

      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue(transactions);

      const result = await service.groupByCategory(
        {
          timeframe: 'daily',
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          groupBy: 'category',
        },
        {},
      );

      expect(result.groups[0].groupKey).toBe('Food');
      expect(result.groups[0].totalAmount).toBe(10);
    });
  });

  describe('groupByAccount', () => {
    it('groups by account name', async () => {
      const fixedDate = new Date('2025-06-15');

      const transactions: TransactionDetail[] = [
        {
          id: 't1',
          type: TransactionType.expense,
          amount: 1,
          date: fixedDate,
          note: null,
          description: null,
          accountId: 'acc-001',
          userId: 'user-id-123',
          categoryId: null,
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          account: { name: 'Wallet' },
          category: null,
          toAccount: null,
        },
        {
          id: 't2',
          type: TransactionType.expense,
          amount: 1,
          date: fixedDate,
          note: null,
          description: null,
          accountId: 'acc-001',
          userId: 'user-id-123',
          categoryId: null,
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          account: { name: 'Wallet' },
          category: null,
          toAccount: null,
        },
      ];

      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue(transactions);

      const result = await service.groupByAccount(
        {
          timeframe: 'daily',
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          groupBy: 'account',
        },
        {},
      );

      expect(result.groups[0].groupKey).toBe('Wallet');
      expect(result.groups[0].totalAmount).toBe(2);
    });
  });

  describe('getRecommendedKeywords', () => {
    it('extracts common keywords from notes', async () => {
      const transactions: TransactionDetail[] = [
        {
          id: 'tx-001',
          userId: mockUser.id,
          type: 'expense',
          amount: 1000,
          date: new Date(),
          accountId: 'acc-001',
          categoryId: null,
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          note: 'Coffee and snack',
          description: null,
          account: null,
          category: null,
          toAccount: null,
        },
        {
          id: 'tx-002',
          userId: mockUser.id,
          type: 'expense',
          amount: 2000,
          date: new Date(),
          accountId: 'acc-001',
          categoryId: null,
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          note: 'Buy coffee beans',
          description: null,
          account: null,
          category: null,
          toAccount: null,
        },
        {
          id: 'tx-003',
          userId: mockUser.id,
          type: 'expense',
          amount: 1500,
          date: new Date(),
          accountId: 'acc-001',
          categoryId: null,
          toAccountId: null,
          linkedTransferId: null,
          createdAt: new Date(),
          isOpening: false,
          dueDate: null,
          paidAt: null,
          recurringTransactionId: null,
          deletedAt: null,
          note: 'Snack time',
          description: null,
          account: null,
          category: null,
          toAccount: null,
        },
      ];

      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue(transactions);

      const words = await service.getRecommendedKeywords(mockUser.id);

      expect(words).toContain('coffee');
      expect(words[0]).toBe('coffee');
    });
  });

  it('throws BadRequestException for invalid groupBy', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

    const invalidQuery = {
      groupBy: 'x',
      timeframe: 'daily',
      startDate: '2025-06-01',
    } as unknown as TransactionGroupQueryDTO;

    await expect(
      service.getGroupedTransactions(mockUser.id, invalidQuery),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getGroupedTransactions(mockUser.id, invalidQuery),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
