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
import { BudgetQueryDTO } from './dto/params/budget-query.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Fresh tests for BudgetsService focusing on deterministic
 * behaviour of each method. Any previous tests are ignored.
 */

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get(BudgetsService);
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
    it('maps prisma budgets to response DTOs', async () => {
      jest.spyOn(prisma.budget, 'findMany').mockResolvedValue([
        {
          ...mockBudget,
          categories: [{ categoryId: mockBudgetCategory.categoryId }],
        },
      ] as any);

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
    const query: BudgetQueryDTO = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      timeframe: 'monthly',
    } as BudgetQueryDTO;

    it('aggregates categories, transactions and budgets', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.category, 'findMany')
        .mockResolvedValue([mockCategory] as any);
      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue([mockTransaction] as any);
      jest
        .spyOn(prisma.budgetCategory, 'findMany')
        .mockResolvedValueOnce([mockBudgetCategory] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.getBudgetCategories(mockUser.id, query);

      expect(result.total).toBe(mockBudgetCategory.amount);
      expect(result.items[0].used).toBe(mockTransaction.amount);
      expect(result.items[0].remaining).toBe(
        mockBudgetCategory.amount - mockTransaction.amount,
      );
      expect(prisma.budgetCategory.findMany).toHaveBeenCalled();
    });

    it('throws when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getBudgetCategories(mockUser.id, query),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createBudgetCategory', () => {
    const dto: BudgetCategoryCreateRequestDTO = {
      categoryId: mockCategory.id,
      amount: 500,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    it('creates a new budget category', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.budget, 'findMany')
        .mockResolvedValue([mockBudget] as any);
      jest
        .spyOn(prisma.category, 'findUnique')
        .mockResolvedValue(mockCategory as any);
      jest.spyOn(prisma.budgetCategory, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(prisma.budgetCategory, 'create')
        .mockResolvedValue({ ...mockBudgetCategory, id: 'new-id' } as any);

      const result = await service.createBudgetCategory(mockUser.id, dto);

      expect(result.budgetId).toBe('new-id');
      expect(prisma.budgetCategory.create).toHaveBeenCalled();
    });

    it('throws conflict when duplicate exists', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.budget, 'findMany')
        .mockResolvedValue([mockBudget] as any);
      jest
        .spyOn(prisma.category, 'findUnique')
        .mockResolvedValue(mockCategory as any);
      jest
        .spyOn(prisma.budgetCategory, 'findFirst')
        .mockResolvedValue(mockBudgetCategory as any);

      await expect(
        service.createBudgetCategory(mockUser.id, dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateBudgetCategory', () => {
    it('updates existing budget category', async () => {
      const dto: BudgetCategoryUpdateRequestDTO = { amount: 200 };
      jest.spyOn(prisma.budgetCategory, 'findFirst').mockResolvedValue({
        ...mockBudgetCategory,
        budget: mockBudget,
        category: mockCategory,
      } as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.budgetCategory, 'update')
        .mockResolvedValue({ ...mockBudgetCategory, amount: 200 } as any);

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
    const query: BudgetQueryDTO = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      timeframe: 'monthly',
    } as BudgetQueryDTO;

    it('returns grouped budgets for category', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.budgetCategory, 'findMany')
        .mockResolvedValue([
          { ...mockBudgetCategory, category: mockCategory },
        ] as any);

      const result = await service.getGroupedBudgetCategories(
        mockUser.id,
        mockCategory.id,
        query,
      );

      expect(result.categoryId).toBe(mockCategory.id);
      expect(result.budgets.length).toBe(12);
      expect(prisma.budgetCategory.findMany).toHaveBeenCalled();
    });
  });
});
