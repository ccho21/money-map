// transactions.transfer.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockAccount,
  mockPrismaFactory,
  mockTransaction,
  mockUser,
  mockTransferTransactionDto,
} from '@/mocks/mockHelpers';
import { TransactionsTransferService } from '../transfer.service';

describe('TransactionsTransferService - transfer logic', () => {
  let service: TransactionsTransferService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsTransferService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get<TransactionsTransferService>(
      TransactionsTransferService,
    );
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransfer', () => {
    it('creates outgoing and incoming transfer', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const fromAccount = {
        ...mockAccount,
        id: 'acc-001',
        type: 'BANK',
        userId: mockUser.id,
        balance: 10000,
      };

      const toAccount = {
        ...mockAccount,
        id: 'acc-002',
        type: 'BANK',
        userId: mockUser.id,
        balance: 0,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
        cb(prisma),
      );

      (prisma.account.findUnique as jest.Mock)
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      const outTx = { id: 'out', type: 'transfer', accountId: fromAccount.id };
      const inTx = { id: 'in', type: 'transfer', accountId: toAccount.id };

      (prisma.transaction.create as jest.Mock)
        .mockResolvedValueOnce(outTx)
        .mockResolvedValueOnce(inTx);

      (prisma.transaction.update as jest.Mock).mockResolvedValue(outTx);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(fromAccount);

      const result = await service.createTransfer(mockUser.id, {
        ...mockTransferTransactionDto,
        amount: 3000,
      });

      expect(result.outgoing.id).toBe('out');
      expect(result.incoming.id).toBe('in');
      expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'out' },
        data: { linkedTransferId: 'in' },
      });
    });
  });

  describe('updateTransfer', () => {
    it('updates transfer pair correctly', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const original = {
        ...mockTransaction,
        id: 'out',
        type: 'transfer',
        accountId: 'acc-001',
        toAccountId: 'acc-002',
        userId: mockUser.id,
        linkedTransferId: 'in',
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(original);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
        cb(prisma),
      );

      const fromAccount = {
        ...mockAccount,
        id: 'acc-001',
        type: 'BANK',
        userId: mockUser.id,
      };

      const toAccount = {
        ...mockAccount,
        id: 'acc-002',
        type: 'BANK',
        userId: mockUser.id,
      };

      (prisma.account.findUnique as jest.Mock)
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(toAccount);

      (prisma.transaction.delete as jest.Mock).mockResolvedValue({});

      const incoming = { id: 'new-in', type: 'transfer', accountId: 'acc-002' };
      const outgoing = { ...original, linkedTransferId: 'new-in' };

      (prisma.transaction.create as jest.Mock).mockResolvedValue(incoming);
      (prisma.transaction.update as jest.Mock).mockResolvedValue(outgoing);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.updateTransfer(mockUser.id, original.id, {
        ...mockTransferTransactionDto,
        amount: 200,
      });

      expect(result.updatedIncoming.id).toBe('new-in');
      expect(result.updatedOutgoing.id).toBe(original.id);
      expect(prisma.transaction.delete).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: original.id },
        data: expect.objectContaining({
          linkedTransferId: 'new-in',
          amount: 200,
        }),
      });
    });
  });

  describe('deleteTransfer', () => {
    it('soft deletes linked transfer transactions', async () => {
      const outgoing = {
        ...mockTransaction,
        id: 'out',
        type: 'transfer',
        linkedTransferId: 'in',
        userId: mockUser.id,
        account: mockAccount,
      };
      const incoming = {
        ...mockTransaction,
        id: 'in',
        type: 'transfer',
        linkedTransferId: 'out',
        userId: mockUser.id,
        account: mockAccount,
      };

      (prisma.transaction.findUnique as jest.Mock)
        .mockResolvedValueOnce(outgoing)
        .mockResolvedValueOnce(incoming);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
        cb(prisma),
      );

      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.deleteTransfer(mockUser.id, 'out');

      expect(result).toEqual({ success: true });
      expect(prisma.transaction.updateMany).toHaveBeenCalled();
    });
  });
});
