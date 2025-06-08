import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockAccount,
  mockAccountCreateRequest,
  mockPrismaFactory,
  mockUser,
} from '@/mocks/mockHelpers';
import { AccountUpdateRequestDTO } from './dto/account-request.dto';
import { Account, Prisma, Transaction } from '@prisma/client';

jest.mock('@/transactions/utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

const { recalculateAccountBalanceInTx } = jest.requireMock(
  '@/transactions/utils/recalculateAccountBalanceInTx.util',
);

describe('AccountsService (unit)', () => {
  let service: AccountsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates account and opening transaction when balance > 0', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<Account>) =>
          cb(prisma),
      );
      (prisma.account.create as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-id',
      } as Transaction);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.create(
        mockUser.id,
        mockAccountCreateRequest,
      );

      expect(result).toEqual(mockAccount);
      expect(prisma.account.create).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates account meta and recalculates balance', async () => {
      const dto: AccountUpdateRequestDTO = {
        name: 'New Name',
        balance: 5000,
      };
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.account.update as jest.Mock).mockResolvedValue({
        ...mockAccount,
        name: 'New Name',
      });
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
        id: 'open-tx',
      } as Transaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue(
        {} as Transaction,
      );
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.update(mockUser.id, mockAccount.id, dto);

      expect(result.name).toBe('New Name');
      expect(prisma.account.update).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all accounts for user', async () => {
      (prisma.account.findMany as jest.Mock).mockResolvedValue([mockAccount]);

      const result = await service.findAll(mockUser.id);

      expect(result).toEqual([mockAccount]);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { type: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns account by id', async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);

      const result = await service.findOne(mockUser.id, mockAccount.id);

      expect(result).toEqual(mockAccount);
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });

  describe('remove', () => {
    it('deletes account and transactions in transaction', async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation((ops: any) =>
        Promise.resolve(ops),
      );

      await service.remove(mockUser.id, mockAccount.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: { accountId: mockAccount.id },
      });
      expect(prisma.account.delete).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });
});
