import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import {
  mockPrismaFactory,
  mockTransaction,
  mockAccount,
  mockUser,
  mockCategory,
  mockCreateTransactionDto,
  mockUpdateTransactionDto,
  mockTransferTransactionDto,
} from '../tests/mocks/mockHelpers';

import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/events/events.gateway';
import { Prisma, TransactionType } from '@prisma/client';
import { GroupBy } from '@/common/types/types';
import { PrismaTransactionClient } from './utils/recalculateAccountBalanceInTx.util';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(),
        },
        {
          provide: EventsGateway,
          useValue: {
            broadcast: jest.fn(), // ✅ 또는 sendMessage 등 필요 메서드
          },
        },
        TransactionsService,
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a transaction and update account balance', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.category.findUnique as jest.Mock).mockResolvedValueOnce(
        mockCategory,
      ); // ✅ 여기가 핵심!
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount); // 다시 mock 필요

      (prisma.transaction.create as jest.Mock).mockResolvedValueOnce(
        mockTransaction,
      );
      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.account.update as jest.Mock).mockResolvedValueOnce(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prisma) => Promise<unknown>) => {
          return await cb(prisma); // ✅ 이제 any 추론 사라짐
        },
      );

      const result = await service.create(
        mockUser.id,
        mockCreateTransactionDto,
      );
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('update', () => {
    it('should update a transaction and account balances', async () => {
      const updatedTransaction = {
        ...mockTransaction,
        ...mockUpdateTransactionDto,
      };

      (prisma.transaction.findFirst as jest.Mock).mockResolvedValueOnce(
        mockTransaction,
      ); // 🔍 기존 트랜잭션 조회
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser); // 🔍 유저 확인
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount); // 🔍 계좌 확인
      (prisma.transaction.update as jest.Mock).mockResolvedValueOnce(
        updatedTransaction,
      ); // 🔄 트랜잭션 업데이트
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]); // 🧮 잔액 재계산용
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount); // 🏦 계좌 잔액 업데이트

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prisma) => Promise<unknown>) => {
          return await cb(prisma); // ✅ 이제 any 추론 사라짐
        },
      );
      const result = await service.update(
        mockUser.id,
        mockTransaction.id,
        mockUpdateTransactionDto,
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(mockUpdateTransactionDto.amount); // 💰 업데이트 확인
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.transaction.update).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.update).toHaveBeenCalled();
    });
  });

  describe('getTransactionById', () => {
    it('should return a transaction if userId matches', async () => {
      const txWithRelations = {
        ...mockTransaction,
        userId: mockUser.id,
        account: mockAccount,
        category: mockCategory,
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce(
        txWithRelations,
      );

      const result = await service.getTransactionById(
        mockUser.id,
        mockTransaction.id,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(mockTransaction.id);
      expect(result.account).toEqual(mockAccount);
      expect(result.category).toEqual(mockCategory);
    });

    it('should throw ForbiddenException if userId does not match', async () => {
      const txWithWrongUser = {
        ...mockTransaction,
        userId: 'other-user-id',
        account: mockAccount,
        category: mockCategory,
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce(
        txWithWrongUser,
      );

      await expect(
        service.getTransactionById(mockUser.id, mockTransaction.id),
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getTransactionSummary', () => {
    it('should return grouped transaction summary', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([
        {
          ...mockTransaction,
          id: 'tx1',
          type: TransactionType.income,
          amount: 1000,
          date: new Date('2024-01-05'),
          userId: mockUser.id,
          account: mockAccount,
          category: mockCategory,
        },
        {
          ...mockTransaction,
          id: 'tx2',
          type: TransactionType.expense,
          amount: 2000,
          date: new Date('2024-01-10'),
          userId: mockUser.id,
          account: mockAccount,
          category: mockCategory,
        },
      ]);

      const result = await service.getTransactionSummary(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: GroupBy.monthly,
      });

      expect(result).toBeDefined();
      expect(result.totalIncome).toBe(1000);
      expect(result.totalExpense).toBe(2000);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]).toHaveProperty('label');
      expect(result.items[0]).toHaveProperty('transactions');
    });
  });

  describe('getTransactionCalendarView', () => {
    it('should return daily calendar summary of transactions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      (prisma.transaction.groupBy as jest.Mock).mockResolvedValueOnce([
        {
          date: new Date('2024-01-10'),
          type: TransactionType.income,
          _sum: { amount: 3000 },
        },
        {
          date: new Date('2024-01-10'),
          type: TransactionType.expense,
          _sum: { amount: 1500 },
        },
      ]);

      const result = await service.getTransactionCalendarView(mockUser.id, {
        date: '2024-01-01',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('income');
      expect(result[0]).toHaveProperty('expense');
      expect(result[0].income).toBe(3000);
      expect(result[0].expense).toBe(1500);
    });
  });

  describe('delete', () => {
    it('should delete a transaction and recalculate balances', async () => {
      const txToDelete = {
        ...mockTransaction,
        id: 'tx1',
        userId: mockUser.id,
        isOpening: false,
      };

      // ✅ 기존 트랜잭션 조회
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(txToDelete);

      // ✅ $transaction 내부 mock
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: any) => Promise<unknown>) => {
          const tx = {
            transaction: {
              delete: jest.fn().mockResolvedValue(undefined),
              findMany: jest.fn().mockResolvedValue([]),
            },
            account: {
              update: jest.fn().mockResolvedValue(mockAccount),
              findUnique: jest.fn().mockResolvedValue(mockAccount),
            },
          };

          return await callback(tx);
        },
      );

      const result = await service.delete(mockUser.id, 'tx1');

      expect(result).toEqual({ message: '삭제 완료' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: 'tx1', userId: mockUser.id },
      });
    });

    it('should throw if transaction is opening balance', async () => {
      const txToDelete = {
        ...mockTransaction,
        id: 'tx1',
        userId: mockUser.id,
        isOpening: true,
        type: TransactionType.expense,
        accountId: mockAccount.id,
        toAccountId: null,
        linkedTransferId: null,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(txToDelete);

      await expect(service.delete(mockUser.id, 'tx1')).rejects.toThrow(
        'Opening Balance는 삭제할 수 없습니다.',
      );
    });

    it('should throw if transaction not found', async () => {
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

      await expect(service.delete(mockUser.id, 'tx1')).rejects.toThrow(
        '거래를 찾을 수 없습니다.',
      );
    });
  });

  describe('createTransfer', () => {
    it('should create a valid outgoing/incoming transfer and return both', async () => {
      // ✅ 유저 존재 mock
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockUser);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: PrismaTransactionClient) => Promise<unknown>) => {
          const tx = {
            account: {
              findUnique: jest.fn().mockResolvedValue(mockAccount),
              update: jest.fn().mockResolvedValue(mockAccount),
            },
            transaction: {
              create: jest
                .fn()
                .mockImplementationOnce(
                  (args: Prisma.TransactionCreateArgs) => ({
                    id: 'tx1',
                    ...args.data,
                    type: TransactionType.transfer,
                  }),
                )
                .mockImplementationOnce(
                  (args: Prisma.TransactionCreateArgs) => ({
                    id: 'tx2',
                    ...args.data,
                    type: TransactionType.transfer,
                  }),
                ),
              update: jest.fn().mockResolvedValue({
                id: 'tx1',
                linkedTransferId: 'tx2',
              }),
              findMany: jest.fn().mockResolvedValue([]),
            },
          };

          return await callback(tx as unknown as PrismaTransactionClient); // ✅ 핵심
        },
      );

      const result = await service.createTransfer(
        mockUser.id,
        mockTransferTransactionDto,
      );

      expect(result).toMatchObject({
        outgoing: { id: 'tx1', type: 'transfer' },
        incoming: { id: 'tx2', type: 'transfer' },
      });

      expect(result.outgoing.accountId).toBe(
        mockTransferTransactionDto.fromAccountId,
      );
      expect(result.incoming.accountId).toBe(
        mockTransferTransactionDto.toAccountId,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateTransfer', () => {
    it('should update an existing transfer transaction', async () => {
      const fromAccount = {
        ...mockAccount,
        id: mockTransferTransactionDto.fromAccountId,
        userId: mockUser.id,
      };
      const toAccount = {
        ...mockAccount,
        id: mockTransferTransactionDto.toAccountId,
        userId: mockUser.id,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const originalTx = {
        ...mockTransaction,
        id: 'tx1',
        type: 'transfer' as TransactionType,
        userId: mockUser.id,
        linkedTransferId: 'tx2',
        accountId: mockTransferTransactionDto.fromAccountId,
        toAccountId: mockTransferTransactionDto.toAccountId,
      };

      jest
        .spyOn(prisma.transaction, 'findUnique')
        .mockResolvedValue(originalTx);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: PrismaTransactionClient) => Promise<unknown>) => {
          const tx = {
            account: {
              findUnique: jest
                .fn()
                .mockResolvedValueOnce(fromAccount)
                .mockResolvedValueOnce(toAccount)
                .mockResolvedValueOnce(fromAccount)
                .mockResolvedValueOnce(toAccount)
                .mockResolvedValueOnce(fromAccount),
              update: jest.fn().mockResolvedValue(mockAccount),
            },
            transaction: {
              delete: jest.fn().mockResolvedValue({ id: 'tx2' }),
              create: jest.fn().mockResolvedValue({
                id: 'tx3',
                type: TransactionType.transfer,
                accountId: mockTransferTransactionDto.toAccountId,
              }),
              update: jest.fn().mockResolvedValue({
                id: 'tx1',
                linkedTransferId: 'tx3',
                accountId: mockTransferTransactionDto.fromAccountId,
              }),
              findMany: jest.fn().mockResolvedValue([]),
            },
          };
          return await callback(tx as unknown as PrismaTransactionClient);
        },
      );

      const result = await service.updateTransfer(
        mockUser.id,
        'tx1',
        mockTransferTransactionDto,
      );

      expect(result.updatedIncoming.id).toBe('tx3');
      expect(result.updatedOutgoing.id).toBe('tx1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('deleteTransfer', () => {
    it('should delete both linked transactions', async () => {
      const outgoing = {
        id: 'tx1',
        type: 'transfer' as TransactionType,
        userId: mockUser.id,
        linkedTransferId: 'tx2',
        accountId: mockAccount.id,
        account: mockAccount,
      };

      const incoming = {
        id: 'tx2',
        type: 'transfer' as TransactionType,
        userId: mockUser.id,
        linkedTransferId: 'tx1',
        accountId: mockAccount.id,
        account: mockAccount,
      };

      // ✅ findUnique 순서대로 두 번 호출
      (prisma.transaction.findUnique as jest.Mock)
        .mockResolvedValueOnce(outgoing) // 1st: outgoing
        .mockResolvedValueOnce(incoming); // 2nd: incoming

      // ✅ deleteMany는 void 반환이라 undefined 처리
      (prisma.transaction.deleteMany as jest.Mock).mockResolvedValue(undefined);

      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prisma) => Promise<unknown>) => {
          return await cb(prisma); // ✅ 이제 any 추론 사라짐
        },
      );

      const result = await service.deleteTransfer(mockUser.id, outgoing.id);

      expect(result).toEqual({ success: true });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.transaction.deleteMany).toHaveBeenCalledTimes(1);
    });
  });
});
