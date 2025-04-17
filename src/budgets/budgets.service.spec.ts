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
import { GroupBy } from '@/common/types/types';

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
        groupBy: GroupBy.MONTHLY,
      });

      expect(result.totalBudget).toBe(mockBudgetCategory.amount);
      expect(result.totalExpense).toBe(mockTransaction.amount);
      expect(result.rate).toBe(
        Math.round((mockTransaction.amount / mockBudgetCategory.amount) * 100),
      );
    });
  });

  describe('getBudgetCategories', () => {
    it('should return budget categories for user and range', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValueOnce([
        mockBudgetCategory,
      ]);
      (prisma.category.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'cat1',
          name: 'Food',
          icon: '🍔',
          type: 'expense',
          userId: mockUser.id,
          color: '#ff0000',
        },
      ]);

      const result = await service.getBudgetCategories(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: GroupBy.MONTHLY,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].categoryId).toBe(mockBudgetCategory.categoryId);
    });
  });
});
