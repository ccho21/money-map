import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { getTransactionDelta } from './utils/getTransactionDelta.util';
import { AccountType, Prisma, TransactionType } from '@prisma/client';
import { recalculateAccountBalanceInTx } from './utils/recalculateAccountBalanceInTx.util';
import { NotFoundException } from '@nestjs/common';
import { EventsGateway } from '@/events/events.gateway';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockAccount,
  mockCategory,
  mockTransaction,
  mockUser,
} from '@/tests/mocks/mockHelpers';

describe('TransactionsService', () => {
  let service: TransactionsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let eventsGateway: EventsGateway; // ✅ 추가
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prisma: PrismaService; // ✅ 추가
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            category: { findUnique: jest.fn() },
            account: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(), // ✅ 이거 꼭 추가해야 spyOn 가능
              aggregate: jest.fn(),
            },
            budgetCategory: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: EventsGateway,
          useValue: {
            emit: jest.fn(),
            broadcast: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    eventsGateway = module.get<EventsGateway>(EventsGateway);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTransactionDelta (utility)', () => {
    const baseTx = {
      amount: 5000,
      accountId: 'acc-001',
      toAccountId: null,
    };

    it('should return -amount for expense from account', () => {
      const tx = { ...baseTx, type: TransactionType.expense };
      const result = getTransactionDelta(tx, 'acc-001');
      expect(result).toBe(-5000);
    });

    it('should return +amount for income to account', () => {
      const tx = { ...baseTx, type: TransactionType.income };
      const result = getTransactionDelta(tx, 'acc-001');
      expect(result).toBe(5000);
    });

    it('should return -amount for transfer withdrawal', () => {
      const tx = {
        ...baseTx,
        type: TransactionType.transfer,
        toAccountId: 'acc-002',
      };
      const result = getTransactionDelta(tx, 'acc-001');
      expect(result).toBe(-5000);
    });

    it('should return +amount for transfer deposit', () => {
      const tx = {
        ...baseTx,
        type: TransactionType.transfer,
        accountId: 'acc-002',
        toAccountId: 'acc-001',
      };
      const result = getTransactionDelta(tx, 'acc-001');
      expect(result).toBe(5000);
    });

    it('should return +amount for linked transfer (toAccountId is null)', () => {
      const tx = {
        ...baseTx,
        type: TransactionType.transfer,
        accountId: 'acc-001',
        toAccountId: null,
      };
      const result = getTransactionDelta(tx, 'acc-001');
      expect(result).toBe(5000);
    });

    it('should return 0 when account is unrelated', () => {
      const tx = { ...baseTx, type: TransactionType.income };
      const result = getTransactionDelta(tx, 'acc-other');
      expect(result).toBe(0);
    });
  });

  describe('recalculateAccountBalanceInTx', () => {
    let tx: Prisma.TransactionClient;

    const mockAccount = {
      id: 'acc-001',
      userId: 'user-123',
      name: 'Main Account',
      type: AccountType.BANK,
      color: null,
      description: null,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      settlementDate: null,
      paymentDate: null,
      autoPayment: null,
    };

    const baseTransaction = {
      id: 'tx-001',
      userId: 'user-123',
      createdAt: new Date(),
      description: null,
      categoryId: null,
      accountId: 'acc-001',
      toAccountId: null,
      linkedTransferId: null,
      date: new Date(),
      note: null,
      isTransfer: false,
      isOpening: false,
    };

    beforeEach(() => {
      tx = {
        account: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        transaction: {
          findMany: jest.fn(),
        },
      } as unknown as Prisma.TransactionClient;
    });

    it('should throw NotFoundException if account is not found', async () => {
      jest.spyOn(tx.account, 'findUnique').mockResolvedValue(null);

      await expect(
        recalculateAccountBalanceInTx(tx, 'acc-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate income and expense correctly', async () => {
      jest.spyOn(tx.account, 'findUnique').mockResolvedValue(mockAccount);

      jest.spyOn(tx.transaction, 'findMany').mockResolvedValue([
        {
          ...baseTransaction,
          type: TransactionType.income,
          amount: 2000,
          dueDate: null,
          paidAt: null,
        },
        {
          ...baseTransaction,
          id: 'tx-002',
          type: TransactionType.expense,
          amount: 500,
          dueDate: null,
          paidAt: null,
        },
      ]);

      const updateSpy = jest
        .spyOn(tx.account, 'update')
        .mockResolvedValue({ ...mockAccount, balance: 1500 });

      const result = await recalculateAccountBalanceInTx(tx, 'acc-001');

      expect(result).toBe(1500);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'acc-001' },
        data: { balance: 1500 },
      });
    });

    it('should calculate transfer in and out correctly', async () => {
      jest.spyOn(tx.account, 'findUnique').mockResolvedValue(mockAccount);

      jest.spyOn(tx.transaction, 'findMany').mockResolvedValue([
        {
          ...baseTransaction,
          id: 'tx-003',
          type: TransactionType.transfer,
          amount: 800,
          accountId: 'acc-001',
          toAccountId: 'acc-002',
          dueDate: null,
          paidAt: null,
        },
        {
          ...baseTransaction,
          id: 'tx-004',
          type: TransactionType.transfer,
          amount: 1000,
          accountId: 'acc-002',
          toAccountId: 'acc-001',
          dueDate: null,
          paidAt: null,
        },
      ]);

      const updateSpy = jest
        .spyOn(tx.account, 'update')
        .mockResolvedValue({ ...mockAccount, balance: 200 });

      const result = await recalculateAccountBalanceInTx(tx, 'acc-001');

      expect(result).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'acc-001' },
        data: { balance: 200 },
      });
    });

    it('should return 0 when there are no transactions', async () => {
      jest.spyOn(tx.account, 'findUnique').mockResolvedValue(mockAccount);
      jest.spyOn(tx.transaction, 'findMany').mockResolvedValue([]);

      const updateSpy = jest
        .spyOn(tx.account, 'update')
        .mockResolvedValue({ ...mockAccount, balance: 0 });

      const result = await recalculateAccountBalanceInTx(tx, 'acc-001');

      expect(result).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'acc-001' },
        data: { balance: 0 },
      });
    });
  });

  describe('create', () => {
    const mockTransactionDto = {
      amount: 5000,
      type: TransactionType.expense,
      date: new Date().toISOString(),
      accountId: 'acc-001',
      categoryId: 'cat-001',
      description: 'Lunch',
      note: 'Team lunch',
    };

    const mockUserId = 'user-123';
    const mockCreatedTransaction = {
      ...mockTransactionDto,
      id: 'tx-123',
      userId: mockUserId,
      createdAt: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create transaction and update account balance', async () => {
      const findUser = jest.spyOn(prisma.user, 'findUnique');
      const findCategory = jest.spyOn(prisma.category, 'findUnique');
      const findAccount = jest.spyOn(prisma.account, 'findUnique');
      const runTransaction = jest.spyOn(prisma, '$transaction'); // ✅ 선언은 여기 한 번만
      const findBudget = jest.spyOn(prisma.budgetCategory, 'findFirst');

      findUser.mockResolvedValue(mockUser);
      findCategory.mockResolvedValue(mockCategory);
      findAccount.mockResolvedValue(mockAccount);
      findBudget.mockResolvedValue(null); // 예산 없다고 가정

      runTransaction.mockImplementation((cb: any) => {
        const txMock = {
          account: {
            findUnique: jest.fn().mockResolvedValue(mockAccount),
            update: jest
              .fn()
              .mockResolvedValue({ ...mockAccount, balance: -5000 }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue(mockCreatedTransaction),
            findMany: jest.fn().mockResolvedValue([]), // ✅ 여기 추가됨!
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return cb(txMock as unknown as Prisma.TransactionClient);
      });
      const result = await service.create(mockUserId, mockTransactionDto);

      expect(result).toEqual(mockCreatedTransaction);
      expect(findUser).toHaveBeenCalledWith({ where: { id: mockUserId } });
      expect(findCategory).toHaveBeenCalledWith({ where: { id: 'cat-001' } });
      expect(findAccount).toHaveBeenCalledWith({ where: { id: 'acc-001' } });
      expect(runTransaction).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const mockUpdateDto = {
      amount: 8000,
      type: TransactionType.expense,
      accountId: 'acc-001',
      categoryId: 'cat-001',
      description: 'Updated',
      note: 'Updated note',
      date: new Date('2023-01-20').toISOString(),
    };

    const mockTransactionId = 'tx-123';

    it('should update transaction and recalculate balance', async () => {
      const findUser = jest.spyOn(prisma.user, 'findUnique');
      const findExisting = jest.spyOn(prisma.transaction, 'findFirst');
      const runTransaction = jest.spyOn(prisma, '$transaction');

      findUser.mockResolvedValue(mockUser);
      findExisting.mockResolvedValue(mockTransaction);

      // ✅ 내부 findUnique mock 추적용 변수
      const findTxInsideTransaction = jest
        .fn()
        .mockResolvedValue(mockTransaction);

      runTransaction.mockImplementation(async (cb: any) => {
        const txMock = {
          transaction: {
            findUnique: findTxInsideTransaction, // ✅ 추적 가능한 mock
            update: jest.fn().mockResolvedValue({
              ...mockTransaction,
              ...mockUpdateDto,
              id: mockTransactionId,
            }),
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(mockTransaction),
          },
          account: {
            findUnique: jest.fn().mockResolvedValue(mockAccount),
            update: jest.fn().mockResolvedValue({
              ...mockAccount,
              balance: -8000,
            }),
          },
        };
        return cb(txMock as unknown as Prisma.TransactionClient);
      });

      const result = await service.update(
        mockUser.id,
        mockTransactionId,
        mockUpdateDto,
      );

      expect(result).toEqual({
        ...mockTransaction,
        ...mockUpdateDto,
        id: mockTransactionId,
      });

      expect(findExisting).toHaveBeenCalledWith({
        where: { id: mockTransactionId, userId: mockUser.id },
      });

      expect(findUser).toHaveBeenCalledWith({ where: { id: mockUser.id } });

      // ✅ 요게 핵심
      expect(findTxInsideTransaction).toHaveBeenCalledWith({
        where: { id: mockTransactionId },
        include: { category: true },
      });

      expect(runTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      const findExisting = jest.spyOn(prisma.transaction, 'findFirst');
      findExisting.mockResolvedValue(null);

      await expect(
        service.update(mockUser.id, mockTransactionId, mockUpdateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    const mockTransactionId = 'tx-123';

    it('should delete transaction and recalculate balance', async () => {
      const findExisting = jest.spyOn(prisma.transaction, 'findFirst');
      const runTransaction = jest.spyOn(prisma, '$transaction');

      findExisting.mockResolvedValue(mockTransaction);

      runTransaction.mockImplementation((cb: any) => {
        const txMock = {
          transaction: {
            delete: jest.fn().mockResolvedValue(mockTransaction),
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(mockTransaction),
          },
          account: {
            findUnique: jest.fn().mockResolvedValue(mockAccount),
            update: jest.fn().mockResolvedValue({ ...mockAccount, balance: 0 }),
          },
        };

        return cb(txMock as unknown as Prisma.TransactionClient);
      });

      const result = await service.delete(mockUser.id, mockTransactionId);

      expect(result).toEqual({ message: '삭제 완료' }); // 테스트 기대값 수정
      expect(findExisting).toHaveBeenCalledWith({
        where: { id: mockTransactionId, userId: mockUser.id },
      });
      expect(runTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      const findExisting = jest.spyOn(prisma.transaction, 'findFirst');
      findExisting.mockResolvedValue(null);

      await expect(
        service.delete(mockUser.id, mockTransactionId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
