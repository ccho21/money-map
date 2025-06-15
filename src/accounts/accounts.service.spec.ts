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
      jest.spyOn(prisma.account, 'create').mockResolvedValue(mockAccount);
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValue({ id: 'tx-id' } as Transaction);
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.account, 'update').mockResolvedValue(mockAccount);

      jest
        .spyOn(prisma, '$transaction')
        .mockImplementation(
          async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>) =>
            cb(prisma),
        );

      const result = await service.create(
        mockUser.id,
        mockAccountCreateRequest,
      );

      const accountSpy = jest.spyOn(prisma.account, 'create');
      const transactionSpy = jest.spyOn(prisma.transaction, 'create');

      expect(result).toEqual(mockAccount);
      expect(accountSpy).toHaveBeenCalled();
      expect(transactionSpy).toHaveBeenCalled();
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
        .spyOn(prisma.transaction, 'findFirst')
        .mockResolvedValue({ id: 'open-tx' } as Transaction);
      jest
        .spyOn(prisma.transaction, 'update')
        .mockResolvedValue({} as Transaction);
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest
        .spyOn(prisma.account, 'update')
        .mockResolvedValue({ ...mockAccount, name: 'New Name' });

      const accountSpy = jest.spyOn(prisma.account, 'update');
      const result = await service.update(mockUser.id, mockAccount.id, dto);

      expect(result.name).toBe('New Name');
      expect(accountSpy).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all accounts for user', async () => {
      jest.spyOn(prisma.account, 'findMany').mockResolvedValue([mockAccount]);

      const accountSpy = jest.spyOn(prisma.account, 'findMany');
      const result = await service.findAll(mockUser.id);

      expect(result).toEqual([mockAccount]);
      expect(accountSpy).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { type: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns account by id', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);
      const accountSpy = jest.spyOn(prisma.account, 'findUnique');
      const result = await service.findOne(mockUser.id, mockAccount.id);

      expect(result).toEqual(mockAccount);
      expect(accountSpy).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });

  describe('remove', () => {
    it('deletes account and transactions in transaction', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(mockAccount);
      jest
        .spyOn(prisma.transaction, 'deleteMany')
        .mockResolvedValue({ count: 1 });
      jest.spyOn(prisma.account, 'delete').mockResolvedValue(mockAccount);

      jest.spyOn(prisma, '$transaction').mockResolvedValue(undefined);
      const accountSpy = jest.spyOn(prisma.account, 'delete');
      const transactionSpy = jest.spyOn(prisma.transaction, 'deleteMany');

      await service.remove(mockUser.id, mockAccount.id);

      expect(transactionSpy).toHaveBeenCalledWith({
        where: { accountId: mockAccount.id },
      });
      expect(accountSpy).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });
});
