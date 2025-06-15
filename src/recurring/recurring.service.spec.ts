import { Test, TestingModule } from '@nestjs/testing';
import { RecurringService } from './recurring.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockUser,
  mockAccount,
  mockTransaction,
} from '@/mocks/mockHelpers';
import {
  RecurringFrequency,
  TransactionType,
  RecurringTransaction,
} from '@prisma/client';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { recalculateAccountBalanceInTx } from '@/transactions/utils/recalculateAccountBalanceInTx.util';

jest.mock('@/transactions/utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

describe('RecurringService (unit)', () => {
  let service: RecurringService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get(RecurringService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a recurring transaction', async () => {
      const dto: CreateRecurringTransactionDto = {
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: null,
        categoryId: 'cat',
        type: TransactionType.expense,
        amount: 1000,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.monthly,
        interval: 2,
        anchorDay: 1,
        endDate: undefined,
        note: 'n',
        description: 'd',
      };

      const mockRecurringTransaction: RecurringTransaction = {
        id: 'rec',
        userId: mockUser.id,
        accountId: dto.accountId,
        toAccountId: dto.toAccountId ?? null,
        categoryId: dto.categoryId ?? null,
        type: dto.type,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        anchorDay: dto.anchorDay ?? null,
        endDate: null,
        note: dto.note ?? null,
        description: dto.description ?? null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.recurringTransaction, 'create')
        .mockResolvedValue(mockRecurringTransaction);

      const spy = jest.spyOn(prisma.recurringTransaction, 'create');
      const result = await service.create(mockUser.id, dto);

      expect(result.id).toBe('rec');
      expect(spy).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          accountId: dto.accountId,
          toAccountId: dto.toAccountId,
          categoryId: dto.categoryId,
          type: dto.type,
          amount: dto.amount,
          startDate: new Date(dto.startDate).toISOString(),
          frequency: dto.frequency,
          interval: dto.interval ?? 1,
          anchorDay: dto.anchorDay,
          endDate: null,
          note: dto.note,
          description: dto.description,
          deletedAt: null,
        },
      });
    });
  });

  describe('softDelete', () => {
    it('soft deletes a recurring transaction', async () => {
      jest
        .spyOn(prisma.recurringTransaction, 'updateMany')
        .mockResolvedValue({ count: 1 }); // ✅ 안전하게 캐스팅

      const spy = jest.spyOn(prisma.recurringTransaction, 'updateMany');
      const result = await service.softDelete(mockUser.id, 'rec-id');

      expect(result).toEqual({ message: '삭제 완료' });
      expect(spy).toHaveBeenCalledWith({
        where: { id: 'rec-id', userId: mockUser.id, deletedAt: null },
        data: { deletedAt: expect.any(Date) as unknown as Date },
      });
    });
  });

  describe('generateUpcomingTransactions', () => {
    it('creates transactions for matching recurring item', async () => {
      jest.spyOn(service, 'shouldGenerateForToday').mockReturnValue(true);

      const recurring: RecurringTransaction = {
        id: 'rec-1',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: null,
        categoryId: 'cat',
        type: TransactionType.expense,
        amount: 100,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: '',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        transactions: [],
      } as unknown as RecurringTransaction;

      jest
        .spyOn(prisma.recurringTransaction, 'findMany')
        .mockResolvedValue([recurring]);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValue({ ...mockTransaction, id: 'tx' });
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.account, 'update').mockResolvedValue(mockAccount);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      await service.generateUpcomingTransactions();
      const spy = jest.spyOn(prisma.transaction, 'create');

      expect(spy).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalledTimes(1);
    });

    it('updates both accounts for transfer', async () => {
      jest.spyOn(service, 'shouldGenerateForToday').mockReturnValue(true);

      const recurring: RecurringTransaction = {
        id: 'rec-2',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: 'acc-2',
        categoryId: 'cat',
        type: TransactionType.transfer,
        amount: 200,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: '',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        transactions: [],
      } as unknown as RecurringTransaction;

      jest
        .spyOn(prisma.recurringTransaction, 'findMany')
        .mockResolvedValue([recurring]);
      jest.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(prisma.transaction, 'create')
        .mockResolvedValue({ ...mockTransaction, id: 'tx' });
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.account, 'update').mockResolvedValue(mockAccount);
      prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

      await service.generateUpcomingTransactions();

      expect(recalculateAccountBalanceInTx).toHaveBeenCalledTimes(2);
    });
  });

  describe('shouldGenerateForToday', () => {
    const base: RecurringTransaction = {
      id: 'r',
      userId: mockUser.id,
      accountId: mockAccount.id,
      toAccountId: null,
      categoryId: null,
      type: TransactionType.expense,
      amount: 1,
      startDate: '2024-01-05T00:00:00Z',
      frequency: RecurringFrequency.monthly,
      interval: 1,
      anchorDay: 5,
      endDate: null,
      note: '',
      description: '',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      transactions: [],
    } as unknown as RecurringTransaction;

    it('returns true when allowDuplicates option is true', () => {
      const result = service.shouldGenerateForToday(
        base,
        new Date('2024-01-01'),
        {
          allowDuplicates: true,
        },
      );
      expect(result).toBe(true);
    });

    it('returns false if today is before start date', () => {
      const result = service.shouldGenerateForToday(
        base,
        new Date('2024-01-01'),
      );
      expect(result).toBe(false);
    });

    it('returns false when anchor day does not match', () => {
      const result = service.shouldGenerateForToday(
        base,
        new Date('2024-01-06'),
      );
      expect(result).toBe(false);
    });

    it('returns true when anchor day matches', () => {
      const result = service.shouldGenerateForToday(
        base,
        new Date('2024-02-05'),
      );
      expect(result).toBe(true);
    });
  });
});
