import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsTransferService } from './transfer.service';
import { TransactionsAnalysisService } from './analysis.service';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';

import {
  mockCreateTransactionDto,
  mockTransferTransactionDto,
  mockUpdateTransactionDto,
  mockTransaction,
  mockUserPayload,
} from '@/mocks/mockHelpers';

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let txService: jest.Mocked<TransactionsService>;
  let analysisService: jest.Mocked<TransactionsAnalysisService>;
  let transferService: jest.Mocked<TransactionsTransferService>;

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    txService = {
      create: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionById: jest.fn().mockResolvedValue(mockTransaction),
      update: jest.fn().mockResolvedValue(mockTransaction),
      delete: jest.fn().mockResolvedValue({ message: 'ok' }),
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    analysisService = {
      getTransactionSummary: jest.fn().mockResolvedValue({ totalIncome: 1000 }),
      getGroupedTransactions: jest.fn().mockResolvedValue({ groups: [] }),
      getTransactionCalendarView: jest
        .fn()
        .mockResolvedValue([{ date: '2024-01-01' }]),
      getRecommendedKeywords: jest.fn().mockResolvedValue(['coffee']),
      getChartFlow: jest.fn().mockResolvedValue({ periods: [] }),
      getChartCategory: jest.fn().mockResolvedValue({ topCategories: [] }),
      getChartAccount: jest.fn().mockResolvedValue({ accounts: [] }),
      getChartBudget: jest.fn().mockResolvedValue({ totalBudget: 0 }),
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    transferService = {
      createTransfer: jest.fn().mockResolvedValue(mockTransaction),
      updateTransfer: jest.fn().mockResolvedValue(mockTransaction),
      deleteTransfer: jest.fn().mockResolvedValue({ message: 'ok' }),
    } as any;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: txService },
        { provide: TransactionsTransferService, useValue: transferService },
        { provide: TransactionsAnalysisService, useValue: analysisService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const req = ctx.switchToHttp().getRequest();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          req.user = mockUserPayload;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /transactions', async () => {
    const expected = {
      ...mockTransaction,
      date: mockTransaction.date.toISOString(),
      createdAt: mockTransaction.createdAt.toISOString(),
      account: {
        ...mockTransaction.account,
        createdAt: mockTransaction.account.createdAt.toISOString(),
        updatedAt: mockTransaction.account.updatedAt.toISOString(),
      },
    };

    await request(app.getHttpServer())
      .post('/transactions')
      .send(mockCreateTransactionDto)
      .expect(201)
      .expect(expected);
  });

  it('GET /transactions/summary', async () => {
    await request(app.getHttpServer())
      .get('/transactions/summary')
      .query({ timeframe: 'monthly' })
      .expect(200)
      .expect({ totalIncome: 1000 });
  });

  it('POST /transactions/transfer', async () => {
    const expected = {
      ...mockTransaction,
      date: mockTransaction.date.toISOString(),
      createdAt: mockTransaction.createdAt.toISOString(),
      account: {
        ...mockTransaction.account,
        createdAt: mockTransaction.account.createdAt.toISOString(),
        updatedAt: mockTransaction.account.updatedAt.toISOString(),
      },
    };
    await request(app.getHttpServer())
      .post('/transactions/transfer')
      .send(mockTransferTransactionDto)
      .expect(201)
      .expect(expected); // ✅ 변환된 expected 사용
  });

  it('PATCH /transactions/:id', async () => {
    const expected = {
      ...mockTransaction,
      date: mockTransaction.date.toISOString(),
      createdAt: mockTransaction.createdAt.toISOString(),
      account: {
        ...mockTransaction.account,
        createdAt: mockTransaction.account.createdAt.toISOString(),
        updatedAt: mockTransaction.account.updatedAt.toISOString(),
      },
    };
    await request(app.getHttpServer())
      .patch(`/transactions/${mockTransaction.id}`)
      .send(mockUpdateTransactionDto)
      .expect(200)
      .expect(expected); // ✅ 동일한 expected 사용
  });

  it('DELETE /transactions/:id', async () => {
    await request(app.getHttpServer())
      .delete(`/transactions/${mockTransaction.id}`)
      .expect(200)
      .expect({ message: 'ok' });
  });
});
