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
import { Prisma, Transaction } from '@prisma/client';
import { recalculateAccountBalanceInTx } from '@/transactions/utils/recalculateAccountBalanceInTx.util';

jest.mock('@/transactions/utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

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

    service = module.get(AccountsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates account and opening transaction when balance > 0', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(
          <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>) => cb(prisma),
        );
      jest.spyOn(prisma.account, 'create').mockResolvedValue(mockAccount);
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValue({ id: 'tx-id' } as Transaction);
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.account, 'update').mockResolvedValue(mockAccount);

      const result = await service.create(
        mockUser.id,
        mockAccountCreateRequest,
      );

      expect(result).toEqual(mockAccount);
      expect(prisma.account.create.bind(prisma.account)).toHaveBeenCalled();
      expect(
        prisma.transaction.create.bind(prisma.transaction),
      ).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates account meta and recalculates balance', async () => {
      const dto: AccountUpdateRequestDTO = {
        name: 'New Name',
        balance: 5000,
      };

      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.account, 'update')
        .mockResolvedValue({ ...mockAccount, name: 'New Name' });
      jest
        .spyOn(prisma.transaction, 'findFirst')
        .mockResolvedValue({ id: 'open-tx' } as Transaction);
      jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue({} as Transaction);
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.account, 'update').mockResolvedValue(mockAccount);

      const result = await service.update(mockUser.id, mockAccount.id, dto);

      expect(result.name).toBe('New Name');
      expect(prisma.account.update.bind(prisma.account)).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all accounts for user', async () => {
      jest.spyOn(prisma.account, 'findMany').mockResolvedValue([mockAccount]);

      const result = await service.findAll(mockUser.id);

      expect(result).toEqual([mockAccount]);
      expect(prisma.account.findMany.bind(prisma.account)).toHaveBeenCalledWith(
        {
          where: { userId: mockUser.id },
          orderBy: { type: 'desc' },
        },
      );
    });
  });

  describe('findOne', () => {
    it('returns account by id', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);

      const result = await service.findOne(mockUser.id, mockAccount.id);

      expect(result).toEqual(mockAccount);
      expect(
        prisma.account.findUnique.bind(prisma.account),
      ).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });

  describe('remove', () => {
    it('deletes account and transactions in transaction', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(
          <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>) => cb(prisma),
        );
      jest
        .spyOn(prisma.transaction, 'deleteMany')
        .mockResolvedValue({ count: 1 });
      jest.spyOn(prisma.account, 'delete').mockResolvedValue(mockAccount);

      await service.remove(mockUser.id, mockAccount.id);

      expect(prisma.$transaction.bind(prisma)).toHaveBeenCalled();
      expect(
        prisma.transaction.deleteMany.bind(prisma.transaction),
      ).toHaveBeenCalledWith({
        where: { accountId: mockAccount.id },
      });
      expect(prisma.account.delete.bind(prisma.account)).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });
});
