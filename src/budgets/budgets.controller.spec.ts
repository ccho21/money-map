import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import {
  BudgetCategoryCreateRequestDTO,
  BudgetCategoryUpdateRequestDTO,
} from './dto/budget-category-request.dto';
import { BudgetQueryDTO } from './dto/params/budget-query.dto';
import {
  mockUserPayload,
  mockBudget,
  mockBudgetCategory,
  mockCategory,
} from '@/mocks/mockHelpers';
import { CategoryType } from '@prisma/client';

const userPayload = mockUserPayload;

describe('BudgetsController (unit)', () => {
  let controller: BudgetsController;
  let service: jest.Mocked<BudgetsService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: mockBudget.id,
          total: mockBudget.total,
          categoryIds: [mockBudgetCategory.categoryId],
          createdAt: mockBudget.createdAt.toISOString(),
          updatedAt: mockBudget.updatedAt.toISOString(),
        },
      ]),
      createBudgetCategory: jest.fn().mockResolvedValue({
        budgetId: 'new-id',
        message: 'created',
      }),
      getBudgetCategories: jest.fn().mockResolvedValue({ total: 0, items: [] }),
      getGroupedBudgetCategories: jest.fn().mockResolvedValue({
        categoryId: mockCategory.id,
        categoryName: mockCategory.name,
        type: mockCategory.type as CategoryType,
        icon: mockCategory.icon,
        color: mockCategory.color,
        totalBudget: 0,
        totalUsed: 0,
        totalRemaining: 0,
        isOver: false,
        budgets: [],
      }),
      updateBudgetCategory: jest
        .fn()
        .mockResolvedValue({ budgetId: 'updated-id', message: 'updated' }),
    } as unknown as jest.Mocked<BudgetsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: service }],
    }).compile();

    controller = module.get(BudgetsController);
  });

  it('findAll() returns budgets for user', async () => {
    const spy = jest.spyOn(service, 'findAll');

    const result = await controller.findAll(userPayload);
    expect(result[0].id).toBe(mockBudget.id);
    expect(spy).toHaveBeenCalledWith(userPayload.id);
  });

  it('createBudgetCategory() creates a budget category', async () => {
    const dto: BudgetCategoryCreateRequestDTO = {
      categoryId: mockCategory.id,
      amount: 1000,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };
    const spy = jest.spyOn(service, 'createBudgetCategory');
    const result = await controller.createBudgetCategory(userPayload, dto);
    expect(result.budgetId).toBe('new-id');
    expect(spy).toHaveBeenCalledWith(userPayload.id, dto);
  });

  it('getByCategory() returns budget categories', async () => {
    const query: BudgetQueryDTO = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      timeframe: 'monthly',
    } as BudgetQueryDTO;
    const spy = jest.spyOn(service, 'getBudgetCategories');
    const result = await controller.getByCategory(userPayload, query);

    expect(result.items).toEqual([]);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getBudgetCategoryByCategoryId() returns grouped categories', async () => {
    const query: BudgetQueryDTO = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      timeframe: 'monthly',
    } as BudgetQueryDTO;
    const spy = jest.spyOn(service, 'getGroupedBudgetCategories');
    const result = await controller.getBudgetCategoryByCategoryId(
      userPayload,
      mockCategory.id,
      query,
    );
    expect(result.categoryId).toBe(mockCategory.id);
    expect(spy).toHaveBeenCalledWith(userPayload.id, mockCategory.id, query);
  });

  it('updateBudgetCategory() updates a budget category', async () => {
    const spy = jest.spyOn(service, 'updateBudgetCategory');
    const dto: BudgetCategoryUpdateRequestDTO = { amount: 500 };
    const result = await controller.updateBudgetCategory(
      userPayload,
      mockCategory.id,
      dto,
    );
    expect(result.message).toBe('updated');
    expect(spy).toHaveBeenCalledWith(userPayload.id, mockCategory.id, dto);
  });
});
