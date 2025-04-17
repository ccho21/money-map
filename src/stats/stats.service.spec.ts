import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockUser,
  mockCategory,
  mockTransaction,
  mockBudgetCategory,
  statsQuery,
} from '@/tests/mocks/mockHelpers';
import { CategoryType } from '@prisma/client';
import { groupTransactions } from './util/groupTransactions.util';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(),
        },
        StatsService,
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByCategory', () => {
    it('should return grouped category stats with summary', async () => {
      // ✅ mock 설정 (as jest.Mock 스타일로 변경)
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory]);
      (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          categoryId: mockCategory.id,
          _sum: { amount: mockTransaction.amount },
        },
      ]);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
        {
          categoryId: mockCategory.id,
          budgetId: mockBudgetCategory.budgetId,
          amount: mockBudgetCategory.amount,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          type: CategoryType.expense,
          id: 'bc-001',
        },
      ]);

      const result = await service.getByCategory(mockUser.id, statsQuery);

      expect(result.startDate).toBe(statsQuery.startDate);
      expect(result.endDate).toBe(statsQuery.endDate);
      expect(result.groupBy).toBe(statsQuery.groupBy);
      expect(result.type).toBe(statsQuery.type);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].categoryId).toBe(mockCategory.id);
      expect(result.summary?.categoryId).toBe('summary');
      expect(result.totalExpense).toBe(mockTransaction.amount);
    });
  });

  describe('getByBudget', () => {
    it('should return grouped budget stats with summary', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory]);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
        {
          ...mockBudgetCategory,
          id: 'bc-001',
          categoryId: mockCategory.id,
          budgetId: mockBudgetCategory.budgetId,
          amount: mockBudgetCategory.amount,
          startDate: new Date(statsQuery.startDate),
          endDate: new Date(statsQuery.endDate),
          type: CategoryType.expense,
        },
      ]);
      (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        {
          categoryId: mockCategory.id,
          _sum: { amount: mockTransaction.amount },
        },
      ]);

      const result = await service.getByBudget(mockUser.id, statsQuery);

      expect(result.startDate).toBe(statsQuery.startDate);
      expect(result.endDate).toBe(statsQuery.endDate);
      expect(result.groupBy).toBe(statsQuery.groupBy);
      expect(result.type).toBe(statsQuery.type);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].categoryId).toBe(mockCategory.id);
      expect(result.items[0].budgetId).toBe(mockBudgetCategory.id);
      expect(result.items[0].spent).toBe(mockTransaction.amount);
      expect(result.summary?.categoryId).toBe('summary');
      expect(result.totalExpense).toBe(mockTransaction.amount);
    });
  });

  describe('getByNote', () => {
    it('should return grouped transactions by note', async () => {
      const tx = { ...mockTransaction, note: 'Starbucks' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([tx]);

      (groupTransactions as jest.Mock).mockReturnValue([
        {
          label: '2024-01',
          rangeStart: statsQuery.startDate,
          rangeEnd: statsQuery.endDate,
          groupIncome: 0,
          groupExpense: tx.amount,
          isCurrent: true,
        },
      ]);

      const result = await service.getByNote(mockUser.id, statsQuery);

      expect(result.startDate).toBe(statsQuery.startDate);
      expect(result.endDate).toBe(statsQuery.endDate);
      expect(result.type).toBe(statsQuery.type);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.note).toBe('Starbucks');
      expect(item.count).toBe(1);
      expect(item.totalExpense).toBe(tx.amount);
      expect(item.totalIncome).toBe(0);
      expect(item.data).toHaveLength(1);
      expect(result.summary?.note).toBe('Summary');
      expect(result.totalExpense).toBe(tx.amount);
      expect(result.totalIncome).toBe(0);
    });
  });

  describe('getStatsCategory', () => {
    it('should return detailed category stats', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      (groupTransactions as jest.Mock).mockReturnValue([
        {
          label: '2024-01',
          rangeStart: statsQuery.startDate,
          rangeEnd: statsQuery.endDate,
          groupIncome: 0,
          groupExpense: mockTransaction.amount,
          isCurrent: true,
        },
      ]);

      const result = await service.getStatsCategory(
        mockUser.id,
        mockCategory.id,
        statsQuery,
      );

      expect(result.categoryId).toBe(mockCategory.id);
      expect(result.categoryName).toBe(mockCategory.name);
      expect(result.icon).toBe(mockCategory.icon);
      expect(result.color).toBe(mockCategory.color);
      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(mockTransaction.amount);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        label: '2024-01',
        rangeStart: statsQuery.startDate,
        rangeEnd: statsQuery.endDate,
        expense: mockTransaction.amount,
        income: 0,
        isCurrent: true,
      });
    });
  });

  describe('getStatsBudget', () => {
    it('should return detailed budget stats', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.budgetCategory.findUnique as jest.Mock).mockResolvedValue({
        ...mockBudgetCategory,
        id: 'bc-001',
        category: mockCategory,
      });

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        mockTransaction,
      ]);

      (groupTransactions as jest.Mock).mockReturnValue([
        {
          label: '2024-01',
          rangeStart: statsQuery.startDate,
          rangeEnd: statsQuery.endDate,
          groupIncome: 0,
          groupExpense: mockTransaction.amount,
          isCurrent: true,
        },
      ]);

      const result = await service.getStatsBudget(
        mockUser.id,
        'bc-001',
        statsQuery,
      );

      expect(result.categoryId).toBe(mockCategory.id);
      expect(result.categoryName).toBe(mockCategory.name);
      expect(result.icon).toBe(mockCategory.icon);
      expect(result.totalBudget).toBe(mockBudgetCategory.amount);
      expect(result.totalExpense).toBe(mockTransaction.amount);
      expect(result.totalRemaining).toBe(
        mockBudgetCategory.amount - mockTransaction.amount,
      );
      expect(result.isOver).toBe(false);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        label: '2024-01',
        rangeStart: statsQuery.startDate,
        rangeEnd: statsQuery.endDate,
        budget: mockBudgetCategory.amount,
        expense: mockTransaction.amount,
        income: 0,
        remaining: mockBudgetCategory.amount - mockTransaction.amount,
        isOver: false,
        isCurrent: true,
      });
    });
  });

  describe('getStatsNote', () => {
    it('should return note detail stats grouped by period', async () => {
      const tx = { ...mockTransaction, note: 'Starbucks' };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([tx]);

      (groupTransactions as jest.Mock).mockReturnValue([
        {
          label: '2024-01',
          rangeStart: statsQuery.startDate,
          rangeEnd: statsQuery.endDate,
          groupIncome: 0,
          groupExpense: tx.amount,
          isCurrent: true,
        },
      ]);

      const result = await service.getStatsNote(
        mockUser.id,
        'Starbucks',
        statsQuery,
      );

      expect(result.note).toBe('Starbucks');
      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(tx.amount);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        label: '2024-01',
        rangeStart: statsQuery.startDate,
        rangeEnd: statsQuery.endDate,
        income: 0,
        expense: tx.amount,
        isCurrent: true,
      });
    });
  });

  describe('StatsService', () => {
    let service: StatsService;
    let prisma: jest.Mocked<PrismaService>;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: PrismaService,
            useValue: mockPrismaFactory(),
          },
          StatsService,
        ],
      }).compile();

      service = module.get<StatsService>(StatsService);
      prisma = module.get(PrismaService);
    });

    describe('getStatsCategorySummary', () => {
      it('should return category stats summarized by period', async () => {
        const tx = {
          ...mockTransaction,
          date: new Date('2024-01-15T00:00:00Z'),
          amount: 5000,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.category.findUnique as jest.Mock).mockResolvedValue(
          mockCategory,
        );
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([tx]);

        const result = await service.getStatsCategorySummary(
          mockUser.id,
          mockCategory.id,
          statsQuery,
        );

        expect(result.startDate).toBe(statsQuery.startDate);
        expect(result.groupBy).toBe(statsQuery.groupBy);
        expect(result.type).toBe(mockCategory.type);
        expect(result.items).toBeInstanceOf(Array);
        expect(result.items.length).toBeGreaterThan(0);

        const firstPeriod = result.items[0];
        if (mockCategory.type === 'expense') {
          expect(firstPeriod.expense).toBe(tx.amount);
          expect(firstPeriod.income).toBe(0);
          expect(result.totalExpense).toBe(tx.amount);
        } else {
          expect(firstPeriod.income).toBe(tx.amount);
          expect(firstPeriod.expense).toBe(0);
          expect(result.totalIncome).toBe(tx.amount);
        }
      });
    });
  });

  describe('StatsService', () => {
    let service: StatsService;
    let prisma: jest.Mocked<PrismaService>;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: PrismaService,
            useValue: mockPrismaFactory(),
          },
          StatsService,
        ],
      }).compile();

      service = module.get<StatsService>(StatsService);
      prisma = module.get(PrismaService);
    });

    describe('getStatsBudgetSummary', () => {
      it('should return budget stats summarized by period', async () => {
        const tx = {
          ...mockTransaction,
          date: new Date('2024-01-10T00:00:00Z'),
          amount: 5000,
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.category.findUnique as jest.Mock).mockResolvedValue(
          mockCategory,
        );
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([tx]);
        (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
          {
            ...mockBudgetCategory,
            id: 'bc-001',
            categoryId: mockCategory.id,
            startDate: new Date(statsQuery.startDate),
            endDate: new Date(statsQuery.endDate),
            amount: 10000,
            type: CategoryType.expense,
          },
        ]);

        const result = await service.getStatsBudgetSummary(
          mockUser.id,
          mockCategory.id,
          statsQuery,
        );

        expect(result.startDate).toBe(statsQuery.startDate);
        expect(result.endDate).toBeDefined();
        expect(result.groupBy).toBe(statsQuery.groupBy);
        expect(result.type).toBe(mockCategory.type);
        expect(result.items).toHaveLength(1);

        const item = result.items[0];
        expect(item.expense).toBe(tx.amount);
        expect(item.budgetAmount).toBe(10000);
        expect(item.remaining).toBe(5000);
        expect(item.isOver).toBe(false);
        expect(result.totalExpense).toBe(tx.amount);
      });
    });
  });

  describe('getStatsNoteSummary', () => {
    it('should return note summary grouped by period', async () => {
      const tx = {
        ...mockTransaction,
        note: 'Starbucks',
        date: new Date('2024-01-15T00:00:00Z'),
        amount: 18000,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([tx]);

      const encodedNote = encodeURIComponent('Starbucks');

      const result = await service.getStatsNoteSummary(
        mockUser.id,
        encodedNote,
        statsQuery,
      );

      expect(result.startDate).toBe(statsQuery.startDate);
      expect(result.endDate).toBeDefined();
      expect(result.groupBy).toBe(statsQuery.groupBy);
      expect(result.type).toBe(statsQuery.type);
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThan(0);

      const item = result.items[0];
      expect(item.income).toBe(0);
      expect(item.expense).toBe(tx.amount);
      expect(result.totalExpense).toBe(tx.amount);
      expect(result.totalIncome).toBe(0);
    });
  });
});
