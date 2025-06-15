import { Test } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionsTransferService } from '../transfer.service';
import {
  mockPrismaFactory,
  mockUser,
  mockAccount,
  mockTransaction,
  mockTransferTransactionDto,
  mockAccount2,
  TransactionDetail,
} from '@/mocks/mockHelpers';
import { recalculateAccountBalanceInTx } from '../utils/recalculateAccountBalanceInTx.util';
import { Transaction, TransactionType } from '@prisma/client';

jest.mock('../utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

describe('TransactionsTransferService (unit)', () => {
  let service: TransactionsTransferService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionsTransferService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get(TransactionsTransferService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createTransfer', () => {
    it('creates outgoing and incoming transactions', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce({ ...mockAccount, balance: 20000 })
        .mockResolvedValueOnce({
          ...mockAccount,
          id: 'acc-2',
          balance: 0,
        });
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValueOnce({
          ...mockTransaction,
          id: 'out',
        })
        .mockResolvedValueOnce({ ...mockTransaction, id: 'in' });
      jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue({ ...mockTransaction, id: 'out' });
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));

      const result = await service.createTransfer(
        mockUser.id,
        mockTransferTransactionDto,
      );

      expect(result.outgoing.id).toBe('out');
      expect(result.incoming.id).toBe('in');
      expect(recalculateAccountBalanceInTx).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateTransfer', () => {
    it('uses original accounts when dto omits them', async () => {
      const original: Transaction = {
        ...mockTransaction,
        id: 'out',
        userId: mockUser.id,
        type: TransactionType.transfer,
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        amount: 15000,
        linkedTransferId: 'in',
      };

      const incoming: Transaction = {
        ...mockTransaction,
        id: 'in',
        userId: mockUser.id,
        type: TransactionType.transfer,
        accountId: 'acc-2',
        toAccountId: null,
        amount: 15000,
        linkedTransferId: 'out',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      // findUnique for 'out' and 'in' transactions
      jest
        .spyOn(prisma.transaction, 'findUnique')
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(incoming);

      // validateTransferAccounts - from/to account lookups
      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce({
          ...mockAccount,
          id: 'acc-1',
          userId: mockUser.id,
          balance: 50000,
        }) // from
        .mockResolvedValueOnce({
          ...mockAccount2,
          id: 'acc-2',
          userId: mockUser.id,
          balance: 0,
        }); // to

      // new inTx creation
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue(incoming);

      // outTx update
      const updateSpy = jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue({ ...original, amount: 300 });

      // transaction wrapper
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));

      // 실행
      const result = await service.updateTransfer(mockUser.id, 'out', {
        amount: 300,
        accountId: original.accountId, // fromAccountId
        toAccountId: incoming.accountId, // toAccountId
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: original.id },
        data: expect.objectContaining({
          amount: 300,
          toAccountId: 'acc-2',
          linkedTransferId: 'in',
          type: 'transfer',
        }) as Partial<Transaction>,
      });

      expect(result.updatedIncoming.id).toBe(incoming.id);
      expect(result.updatedOutgoing.id).toBe(original.id);
    });
  });

  describe('deleteTransfer', () => {
    it('marks transfers as deleted', async () => {
      const outgoing: TransactionDetail = {
        ...mockTransaction,
        id: 'out',
        type: 'transfer',
        userId: mockUser.id,
        linkedTransferId: 'in',
        accountId: 'acc-1',
        deletedAt: null,
      };
      const incoming: TransactionDetail = {
        ...mockTransaction,
        id: 'in',
        type: 'transfer',
        userId: mockUser.id,
        accountId: 'acc-2',
        linkedTransferId: 'out',
        deletedAt: null,
      };

      jest
        .spyOn(prisma.transaction, 'findUnique')
        .mockResolvedValueOnce(outgoing)
        .mockResolvedValueOnce(incoming);

      const updateManySpy = jest
        .spyOn(prisma.transaction, 'updateMany')
        .mockResolvedValue({ count: 2 });

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(async (cb) => cb(prisma));

      const result = await service.deleteTransfer(mockUser.id, 'out');

      expect(updateManySpy).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
});
