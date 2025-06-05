import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockUser,
  mockBudget,
  mockBudgetCategory,
  mockTransaction,
} from '@/tests/mocks/mockHelpers';
describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(),
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all budgets for the user', async () => {
      (prisma.budget.findMany as jest.Mock).mockResolvedValueOnce([
        {
          ...mockBudget,
          categories: [{ categoryId: mockBudgetCategory.categoryId }],
        },
      ]);

      const result = await service.findAll(mockUser.id);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockBudget.id);
    });
  });

  describe('getSummary', () => {
    it('should calculate total budget, expenses, and rate', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValueOnce([
        mockBudgetCategory,
      ]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([
        mockTransaction,
      ]);

      const result = await service.getSummary(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        timeframe: 'monthly',
      });

      expect(result.totalBudget).toBe(mockBudgetCategory.amount);
      expect(result.totalSpent).toBe(mockTransaction.amount);
      expect(result.rate).toBe(
        Math.round((mockTransaction.amount / mockBudgetCategory.amount) * 100),
      );
    });
  });

  describe('getBudgetCategories', () => {
    const category = {
      id: 'cat1',
      name: 'Food',
      icon: '🍔',
      type: 'expense',
      userId: mockUser.id,
      color: '#ff0000',
    };

    const fallbackBudgetCategory = {
      ...mockBudgetCategory,
      categoryId: category.id,
      amount: 400,
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      budgetId: 'fallback-budget-id',
    };

    const currentBudgetCategory = {
      ...mockBudgetCategory,
      categoryId: category.id,
      amount: 300,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      budgetId: 'current-budget-id',
    };

    it('should return budget categories for user and range', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValueOnce([category]);

      // current range contains budget
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValueOnce([
        currentBudgetCategory,
      ]); // current range
      // fallback call may not be triggered if current range exists

      const result = await service.getBudgetCategories(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        timeframe: 'monthly',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].categoryId).toBe(category.id);
      expect(result.items[0].amount).toBe(300);
    });

    it('should use fallback budget when no current range match', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValueOnce([category]);

      (prisma.budgetCategory.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // current range
        .mockResolvedValueOnce([fallbackBudgetCategory]); // fallback

      const result = await service.getBudgetCategories(mockUser.id, {
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        timeframe: 'monthly',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].categoryId).toBe(category.id);
      expect(result.items[0].amount).toBe(400);
      expect(result.items[0].budgetId).toBe('fallback-budget-id');
    });
  });
});
