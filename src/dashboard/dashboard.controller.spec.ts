import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { mockUserPayload } from '@/mocks/mockHelpers';
import { TransactionGroupQueryDTO } from '@/transactions/dto/params/transaction-group-query.dto';
import { DashboardDTO } from './dto/dashboard.dto';

const userPayload = mockUserPayload;

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  beforeEach(async () => {
    service = {
      getDashboard: jest.fn(),
    } as unknown as jest.Mocked<DashboardService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('getDashboard() returns dashboard data', async () => {
    const query: TransactionGroupQueryDTO = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    const expected: DashboardDTO = {
      balance: 0,
      budget: { used: 0, total: 0, usageRate: 0 },
      monthlySpending: { amount: 0 },
      categoryMonthly: [],
      insights: [],
    } as DashboardDTO;

    const spy = jest.spyOn(service, 'getDashboard').mockResolvedValue(expected);

    const result = await controller.getDashboard(userPayload, query);

    expect(result).toBe(expected);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });
});
