import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import {
  mockCreateTransactionDto,
  mockUpdateTransactionDto,
  mockTransferTransactionDto,
  mockTransaction,
  mockUser,
} from '../tests/mocks/mockHelpers';

xdescribe('TransactionsController HTTP', () => {
  let app: INestApplication;
  let service: jest.Mocked<TransactionsService>;

  const query = {
    timeframe: 'daily',
    groupBy: 'date',
    startDate: '2024-01-01',
  };

  beforeAll(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionSummary: jest.fn().mockResolvedValue({ total: 100 }),
      getGroupedTransactions: jest.fn().mockResolvedValue([{ id: 'group' }]),
      getTransactionCalendarView: jest
        .fn()
        .mockResolvedValue([{ date: '2024-01-01' }]),
      getRecommendedKeywords: jest.fn().mockResolvedValue(['coffee']),
      getChartFlow: jest.fn().mockResolvedValue({} as any),
      getChartCategory: jest.fn().mockResolvedValue({} as any),
      getChartAccount: jest.fn().mockResolvedValue({} as any),
      getChartBudget: jest.fn().mockResolvedValue({} as any),
      createTransfer: jest.fn().mockResolvedValue(mockTransaction),
      updateTransfer: jest.fn().mockResolvedValue(mockTransaction),
      deleteTransfer: jest.fn().mockResolvedValue({ message: 'ok' }),
      getTransactionById: jest.fn().mockResolvedValue(mockTransaction),
      update: jest.fn().mockResolvedValue(mockTransaction),
      delete: jest.fn().mockResolvedValue({ message: 'ok' }),
    } as unknown as jest.Mocked<TransactionsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('basic transaction endpoints', () => {
    it('POST /transactions', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .send(mockCreateTransactionDto)
        .expect(201)
        .expect(mockTransaction);

      expect(service.create).toHaveBeenCalledWith(
        mockUser.id,
        mockCreateTransactionDto,
      );
    });

    it('GET /transactions/summary', async () => {
      await request(app.getHttpServer())
        .get('/transactions/summary')
        .query(query)
        .expect(200)
        .expect({ total: 100 });

      expect(service.getTransactionSummary).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });

    it('GET /transactions/groups', async () => {
      await request(app.getHttpServer())
        .get('/transactions/groups')
        .query(query)
        .expect(200)
        .expect([{ id: 'group' }]);

      expect(service.getGroupedTransactions).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });

    it('GET /transactions/calendar', async () => {
      await request(app.getHttpServer())
        .get('/transactions/calendar')
        .query(query)
        .expect(200)
        .expect([{ date: '2024-01-01' }]);

      expect(service.getTransactionCalendarView).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });

    it('GET /transactions/keyword/recommendations', async () => {
      await request(app.getHttpServer())
        .get('/transactions/keyword/recommendations')
        .expect(200)
        .expect(['coffee']);

      expect(service.getRecommendedKeywords).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('chart endpoints', () => {
    it('GET /transactions/charts/flow', async () => {
      await request(app.getHttpServer())
        .get('/transactions/charts/flow')
        .query(query)
        .expect(200)
        .expect({});

      expect(service.getChartFlow).toHaveBeenCalledWith(mockUser.id, query);
    });

    it('GET /transactions/charts/category', async () => {
      await request(app.getHttpServer())
        .get('/transactions/charts/category')
        .query(query)
        .expect(200)
        .expect({});

      expect(service.getChartCategory).toHaveBeenCalledWith(mockUser.id, query);
    });

    it('GET /transactions/charts/account', async () => {
      await request(app.getHttpServer())
        .get('/transactions/charts/account')
        .query(query)
        .expect(200)
        .expect({});

      expect(service.getChartAccount).toHaveBeenCalledWith(mockUser.id, query);
    });

    it('GET /transactions/charts/budget', async () => {
      await request(app.getHttpServer())
        .get('/transactions/charts/budget')
        .query(query)
        .expect(200)
        .expect({});

      expect(service.getChartBudget).toHaveBeenCalledWith(mockUser.id, query);
    });
  });

  describe('transfer endpoints', () => {
    it('POST /transactions/transfer', async () => {
      await request(app.getHttpServer())
        .post('/transactions/transfer')
        .send(mockTransferTransactionDto)
        .expect(201)
        .expect(mockTransaction);

      expect(service.createTransfer).toHaveBeenCalledWith(
        mockUser.id,
        mockTransferTransactionDto,
      );
    });

    it('PATCH /transactions/transfer/:id', async () => {
      await request(app.getHttpServer())
        .patch('/transactions/transfer/tx-123')
        .send(mockUpdateTransactionDto)
        .expect(200)
        .expect(mockTransaction);

      expect(service.updateTransfer).toHaveBeenCalledWith(
        mockUser.id,
        'tx-123',
        mockUpdateTransactionDto,
      );
    });

    it('DELETE /transactions/transfer/:id', async () => {
      await request(app.getHttpServer())
        .delete('/transactions/transfer/tx-123')
        .expect(200)
        .expect({ message: 'ok' });

      expect(service.deleteTransfer).toHaveBeenCalledWith(
        mockUser.id,
        'tx-123',
      );
    });
  });

  describe('single transaction endpoints', () => {
    it('GET /transactions/:id', async () => {
      await request(app.getHttpServer())
        .get(`/transactions/${mockTransaction.id}`)
        .expect(200)
        .expect(mockTransaction);

      expect(service.getTransactionById).toHaveBeenCalledWith(
        mockUser.id,
        mockTransaction.id,
      );
    });

    it('PATCH /transactions/:id', async () => {
      await request(app.getHttpServer())
        .patch(`/transactions/${mockTransaction.id}`)
        .send(mockUpdateTransactionDto)
        .expect(200)
        .expect(mockTransaction);

      expect(service.update).toHaveBeenCalledWith(
        mockUser.id,
        mockTransaction.id,
        mockUpdateTransactionDto,
      );
    });

    it('DELETE /transactions/:id', async () => {
      await request(app.getHttpServer())
        .delete(`/transactions/${mockTransaction.id}`)
        .expect(200)
        .expect({ message: 'ok' });

      expect(service.delete).toHaveBeenCalledWith(
        mockUser.id,
        mockTransaction.id,
      );
    });
  });
});
