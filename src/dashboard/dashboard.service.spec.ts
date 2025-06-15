import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@/prisma/prisma.service';
import { InsightsService } from '@/insights/insights.service';
import {
  mockAccount,
  mockBudgetCategory,
  mockPrismaFactory,
  mockTransaction,
  mockUser,
  TransactionWithCategory,
} from '@/mocks/mockHelpers';
import { TransactionGroupQueryDTO } from '@/transactions/dto/params/transaction-group-query.dto';
import { Account, Transaction } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;
  let insight: jest.Mocked<InsightsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        { provide: InsightsService, useValue: { generateInsights: jest.fn() } },
      ],
    }).compile();

    service = module.get(DashboardService);
    prisma = module.get(PrismaService);
    insight = module.get(InsightsService);
  });

  const query: TransactionGroupQueryDTO = {
    timeframe: 'monthly',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    groupBy: 'date',
  };

  it('throws if user does not exist', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    await expect(service.getDashboard('bad-user', query)).rejects.toThrow(
      'User not found',
    );
  });

  it('computes dashboard with comparisons', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
    jest.spyOn(prisma.account, 'findMany').mockResolvedValue([
      { ...mockAccount, balance: 500 },
      { ...mockAccount, balance: 1000 },
    ] satisfies Account[]);

    jest.spyOn(prisma.budgetCategory, 'findMany').mockResolvedValue([
      { ...mockBudgetCategory, amount: 100 },
      { ...mockBudgetCategory, amount: 100 },
    ]);
    jest
      .spyOn(prisma.transaction, 'findMany')
      .mockResolvedValueOnce([
        { ...mockTransaction, amount: 70 },
        { ...mockTransaction, amount: 30 },
      ] satisfies Transaction[])
      .mockResolvedValueOnce([
        { ...mockTransaction, amount: 40 },
        { ...mockTransaction, amount: 20 },
      ] satisfies Transaction[])
      .mockResolvedValueOnce([
        {
          ...mockTransaction,
          amount: 70,
          categoryId: 'c1',
          category: { name: 'Food', color: '#f00' },
        },
        {
          ...mockTransaction,
          amount: 30,
          categoryId: 'c1',
          category: { name: 'Food', color: '#f00' },
        },
      ] as TransactionWithCategory[])
      .mockResolvedValueOnce([] satisfies Transaction[]);

    const result = await service.getDashboard(mockUser.id, query);

    expect(result.balance).toBe(1500);
    expect(result.budget).toMatchObject({
      used: 100,
      total: 200,
      usageRate: 50,
      comparison: {
        previousUsageRate: 30,
        difference: 20,
        percentChange: '20.0%',
        trend: 'increase',
      },
    });
    expect(result.monthlySpending.comparison).toMatchObject({
      previousAmount: 60,
      difference: 40,
      percentChange: '66.7%',
      trend: 'increase',
    });
    expect(result.categoryMonthly[0]).toEqual({
      categoryId: 'c1',
      name: 'Food',
      color: '#f00',
      percent: 100,
    });

    // jest.spyOn(insight, 'generateInsights').mockResolvedValue([{ id: 'ins' }]);

    // expect(insight.generateInsights).toHaveBeenCalledWith(
    //   mockUser.id,
    //   ['dashboard'],
    //   expect.any(Object),
    // );
    // expect(prisma.transaction.findMany).toHaveBeenCalledTimes(4);
  });

  it('skips comparisons for custom timeframe', async () => {
    const custom: TransactionGroupQueryDTO = { ...query, timeframe: 'custom' };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
    jest
      .spyOn(prisma.account, 'findMany')
      .mockResolvedValue([
        { ...mockAccount, balance: 300 },
      ] satisfies Account[]);

    jest
      .spyOn(prisma.budgetCategory, 'findMany')
      .mockResolvedValue([{ ...mockBudgetCategory, amount: 300 }]);

    jest
      .spyOn(prisma.transaction, 'findMany')
      .mockResolvedValueOnce([
        { ...mockTransaction, amount: 10 },
      ] satisfies Transaction[])
      .mockResolvedValueOnce([
        {
          ...mockTransaction,
          amount: 70,
          categoryId: 'c1',
          category: { name: 'Food', color: '#f00' },
        },
        {
          ...mockTransaction,
          amount: 30,
          categoryId: 'c1',
          category: { name: 'Food', color: '#f00' },
        },
      ] as TransactionWithCategory[])
      .mockResolvedValueOnce([] satisfies Transaction[]);
    jest.spyOn(insight, 'generateInsights').mockResolvedValue([]);

    const transactionSpy = jest.spyOn(prisma.transaction, 'findMany');
    const result = await service.getDashboard(mockUser.id, custom);

    expect(result.budget.comparison).toBeUndefined();
    expect(result.monthlySpending.comparison).toBeUndefined();
    expect(transactionSpy).toHaveBeenCalledTimes(2);
  });
});
