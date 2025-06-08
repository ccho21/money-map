import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockUser,
  mockBudget,
  mockBudgetCategory,
  mockCategory,
  mockTransaction,
} from '@/mocks/mockHelpers';
import {
  BudgetCategoryCreateRequestDTO,
  BudgetCategoryUpdateRequestDTO,
} from './dto/budget-category-request.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BudgetsService (unit)', () => {
  let service: BudgetsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    prisma = module.get(PrismaService);
    // add missing prisma mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.transaction as any).aggregate = jest.fn();
    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns mapped budgets for user', async () => {
      (prisma.budget.findMany as jest.Mock).mockResolvedValue([
        { ...mockBudget, categories: [{ categoryId: mockBudgetCategory.categoryId }] },
      ]);

      const result = await service.findAll(mockUser.id);

      expect(result).toEqual([
        {
          id: mockBudget.id,
          total: mockBudget.total,
          categoryIds: [mockBudgetCategory.categoryId],
          createdAt: mockBudget.createdAt.toISOString(),
          updatedAt: mockBudget.updatedAt.toISOString(),
        },
      ]);
      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: { categories: true },
      });
    });
  });

  describe('getBudgetCategories', () => {
    it('aggregates categories, transactions and budgets', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction]);
      (prisma.budgetCategory.findMany as jest.Mock)
        .mockResolvedValueOnce([mockBudgetCategory])
        .mockResolvedValueOnce([]);

      const result = await service.getBudgetCategories(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        timeframe: 'monthly',
      });

      expect(result.total).toBe(mockBudgetCategory.amount);
      expect(result.items[0].used).toBe(mockTransaction.amount);
      expect(result.items[0].remaining).toBe(
        mockBudgetCategory.amount - mockTransaction.amount,
      );
    });
  });

  describe('createBudgetCategory', () => {
    it('creates a new budget category', async () => {
      const dto: BudgetCategoryCreateRequestDTO = {
        categoryId: mockCategory.id,
        amount: 500,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.budget.findMany as jest.Mock).mockResolvedValue([mockBudget]);
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.budgetCategory.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.budgetCategory.create as jest.Mock).mockResolvedValue({
        ...mockBudgetCategory,
        id: 'new-id',
      });

      const result = await service.createBudgetCategory(mockUser.id, dto);

      expect(result.budgetId).toBe('new-id');
      expect(prisma.budgetCategory.create).toHaveBeenCalled();
    });

    it('throws conflict when duplicate exists', async () => {
      const dto: BudgetCategoryCreateRequestDTO = {
        categoryId: mockCategory.id,
        amount: 500,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.budget.findMany as jest.Mock).mockResolvedValue([mockBudget]);
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.budgetCategory.findFirst as jest.Mock).mockResolvedValue(mockBudgetCategory);

      await expect(
        service.createBudgetCategory(mockUser.id, dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateBudgetCategory', () => {
    it('updates existing budget category', async () => {
      const dto: BudgetCategoryUpdateRequestDTO = { amount: 200 };
      (prisma.budgetCategory.findFirst as jest.Mock).mockResolvedValue({
        ...mockBudgetCategory,
        budget: mockBudget,
        category: mockCategory,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.budgetCategory.update as jest.Mock).mockResolvedValue({
        ...mockBudgetCategory,
        amount: 200,
      });

      const result = await service.updateBudgetCategory(
        mockUser.id,
        mockCategory.id,
        dto,
      );

      expect(result.message).toContain('updated');
      expect(prisma.budgetCategory.update).toHaveBeenCalled();
    });
  });

  describe('getGroupedBudgetCategories', () => {
    it('returns grouped budgets for category', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
        { ...mockBudgetCategory, category: mockCategory },
      ]);

      const result = await service.getGroupedBudgetCategories(mockUser.id, mockCategory.id, {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        timeframe: 'monthly',
      });

      expect(result.categoryId).toBe(mockCategory.id);
      expect(result.budgets.length).toBe(12);
      expect(prisma.budgetCategory.findMany).toHaveBeenCalled();
    });
  });
});