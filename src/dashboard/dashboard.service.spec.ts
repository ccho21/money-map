import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@/prisma/prisma.service';
import { InsightService } from '@/insights/insights.service';
import { mockPrismaFactory, mockUser } from '@/mocks/mockHelpers';
import { TransactionGroupQueryDTO } from '@/transactions/dto/params/transaction-group-query.dto';

describe('DashboardService (unit)', () => {
  let service: DashboardService;
  let prisma: jest.Mocked<PrismaService>;
  let insight: jest.Mocked<InsightService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        {
          provide: InsightService,
          useValue: {
            generateInsights: jest.fn().mockResolvedValue([]), // already arrow-safe
          },
        },
      ],
    }).compile();

    service = module.get(DashboardService);
    prisma = module.get(PrismaService);
    insight = module.get(InsightService);
    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    const baseQuery: TransactionGroupQueryDTO = {
      timeframe: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      groupBy: 'date',
    };

    it('throws when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getDashboard('missing', baseQuery)).rejects.toThrow(
        'User not found',
      );
    });

    it('returns dashboard info with comparisons', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.account.findMany as jest.Mock).mockResolvedValue([
        { balance: 1000 },
        { balance: 500 },
      ]);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
        { amount: 100 },
        { amount: 50 },
      ]);
      (prisma.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce([{ amount: 30 }, { amount: 20 }])
        .mockResolvedValueOnce([{ amount: 40 }, { amount: 20 }])
        .mockResolvedValueOnce([
          {
            amount: 30,
            categoryId: 'c1',
            category: { name: 'Food', color: '#f00' },
          },
          {
            amount: 20,
            categoryId: 'c1',
            category: { name: 'Food', color: '#f00' },
          },
        ])
        .mockResolvedValueOnce([]);
      (insight.generateInsights as jest.Mock).mockResolvedValue([
        { id: 'ins1' },
      ]);

      const result = await service.getDashboard(mockUser.id, baseQuery);

      expect(result.balance).toBe(1500);
      expect(result.budget.total).toBe(150);
      expect(result.budget.used).toBe(50);
      expect(result.budget.usageRate).toBe(33);
      expect(result.budget.comparison?.previousUsageRate).toBe(40);
      expect(result.monthlySpending.comparison?.previousAmount).toBe(60);
      expect(result.categoryMonthly[0]).toEqual({
        categoryId: 'c1',
        name: 'Food',
        color: '#f00',
        percent: 100,
      });
      expect(insight.generateInsights.bind(insight)).toHaveBeenCalledWith(
        mockUser.id,
        ['dashboard'],
        expect.objectContaining({
          startDate: baseQuery.startDate,
          endDate: baseQuery.endDate,
          timeframe: baseQuery.timeframe,
        }),
      );

      const spy = jest.spyOn(prisma.transaction, 'findMany');
      expect(spy).toHaveBeenCalledTimes(4);
    });

    it('omits comparisons for custom timeframe', async () => {
      const query = { ...baseQuery, timeframe: 'custom' as const };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.account.findMany as jest.Mock).mockResolvedValue([
        { balance: 100 },
      ]);
      (prisma.budgetCategory.findMany as jest.Mock).mockResolvedValue([
        { amount: 100 },
      ]);
      (prisma.transaction.findMany as jest.Mock)
        .mockResolvedValueOnce([{ amount: 10 }])
        .mockResolvedValueOnce([
          {
            amount: 10,
            categoryId: 'c1',
            category: { name: 'Food', color: '#f00' },
          },
        ])
        .mockResolvedValueOnce([]);
      (insight.generateInsights as jest.Mock).mockResolvedValue([]);

      const result = await service.getDashboard(mockUser.id, query);

      expect(result.budget.comparison).toBeUndefined();
      expect(result.monthlySpending.comparison).toBeUndefined();
      expect(void prisma.transaction.findMany).toHaveBeenCalledTimes(3);
    });
  });
});
