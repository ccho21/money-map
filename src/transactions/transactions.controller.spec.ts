import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import {
  mockCreateTransactionDto,
  mockTransaction,
  mockUser,
} from '../tests/mocks/mockHelpers';

describe('TransactionsController (http)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn().mockResolvedValue(mockTransaction),
    getTransactionById: jest.fn().mockResolvedValue(mockTransaction),
    delete: jest.fn().mockResolvedValue({ message: '삭제 완료' }),
  } as Partial<TransactionsService>;

  const guard = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = mockUser;
      return true;
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /transactions creates a transaction', async () => {
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

  it('GET /transactions/:id returns transaction', async () => {
    await request(app.getHttpServer())
      .get(`/transactions/${mockTransaction.id}`)
      .expect(200)
      .expect(mockTransaction);

    expect(service.getTransactionById).toHaveBeenCalledWith(
      mockUser.id,
      mockTransaction.id,
    );
  });

  it('DELETE /transactions/:id removes transaction', async () => {
    await request(app.getHttpServer())
      .delete(`/transactions/${mockTransaction.id}`)
      .expect(200)
      .expect({ message: '삭제 완료' });

    expect(service.delete).toHaveBeenCalledWith(mockUser.id, mockTransaction.id);
  });
});
