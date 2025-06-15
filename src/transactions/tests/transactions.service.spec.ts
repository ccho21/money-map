import { Test } from '@nestjs/testing';
import { TransactionsService } from '../transactions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BudgetAlertService } from '../budget-alert.service';
import {
  mockPrismaFactory,
  mockUser,
  mockAccount,
  mockCategory,
  mockTransaction,
  mockCreateTransactionDto,
  mockUpdateTransactionDto,
  TransactionDetail,
} from '@/mocks/mockHelpers';
import { recalculateAccountBalanceInTx } from '../utils/recalculateAccountBalanceInTx.util';

jest.mock('../utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

describe('TransactionsService (unit)', () => {
  let service: TransactionsService;
  let prisma: jest.Mocked<PrismaService>;
  let alerts: BudgetAlertService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        { provide: BudgetAlertService, useValue: { checkAndEmit: jest.fn() } },
      ],
    }).compile();

    service = module.get(TransactionsService);
    prisma = module.get(PrismaService);
    alerts = module.get(BudgetAlertService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a transaction', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValue(mockCategory);
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValue(mockTransaction);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));

      const txSpy = jest.spyOn(prisma.transaction, 'create');
      const alertSpy = jest.spyOn(alerts, 'checkAndEmit');
      const result = await service.create(
        mockUser.id,
        mockCreateTransactionDto,
      );

      expect(txSpy).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalledWith(
        prisma,
        mockCreateTransactionDto.accountId,
        mockUser.id,
      );
      expect(alertSpy).toHaveBeenCalled();
      expect(result).toBe(mockTransaction);
    });

    it('throws when user missing', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.create(mockUser.id, mockCreateTransactionDto),
      ).rejects.toThrow('User not found');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when transaction absent', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(null);

      await expect(
        service.update(mockUser.id, 'tx', {}),
      ).rejects.toBeInstanceOf(Error);
    });

    it('updates transaction and recalculates balance', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
        ...mockTransaction,
        userId: mockUser.id,
      });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue(mockTransaction);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));

      const txSpy = jest.spyOn(prisma.transaction, 'update');
      const result = await service.update(
        mockUser.id,
        mockTransaction.id,
        mockUpdateTransactionDto,
      );

      expect(txSpy).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
      expect(result).toBe(mockTransaction);
    });
  });

  describe('delete', () => {
    it('soft deletes transaction', async () => {
      const txSpy = jest.spyOn(prisma.transaction, 'update');
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue({
        ...mockTransaction,
        userId: mockUser.id,
        deletedAt: null,
      });
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));
      jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue(mockTransaction);

      const result = await service.delete(mockUser.id, mockTransaction.id);

      expect(txSpy).toHaveBeenCalled();
      expect(result).toEqual({ message: '삭제 완료' });
    });
  });

  describe('getTransactionById', () => {
    it('returns mapped transaction', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
        ...mockTransaction,
        account: mockAccount,
        toAccount: null,
        category: null,
      } as TransactionDetail);

      const result = await service.getTransactionById(
        mockUser.id,
        mockTransaction.id,
      );

      expect(result.id).toBe(mockTransaction.id);
      expect(result.account.id).toBe(mockAccount.id);
    });
  });
});
