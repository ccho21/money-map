import { Test, TestingModule } from '@nestjs/testing';
import { RecurringService } from './recurring.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory, mockAccount, mockUser } from '@/mocks/mockHelpers';
import { RecurringFrequency, TransactionType, RecurringTransaction } from '@prisma/client';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';

jest.mock('@/transactions/utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

const { recalculateAccountBalanceInTx } = jest.requireMock('@/transactions/utils/recalculateAccountBalanceInTx.util');

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
    it('creates recurring transaction with dto', async () => {
      const dto: CreateRecurringTransactionDto = {
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: null,
        categoryId: 'cat-1',
        type: TransactionType.expense,
        amount: 1000,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.monthly,
        interval: 1,
        anchorDay: 1,
        endDate: undefined,
        note: 'note',
        description: 'desc',
      };
      const created = { id: 'rec-1' } as any;
      (prisma.recurringTransaction.create as jest.Mock).mockResolvedValue(created);

      const result = await service.create(mockUser.id, dto);

      expect(result).toBe(created);
      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
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
    it('marks recurring transaction as deleted', async () => {
      (prisma.recurringTransaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await service.softDelete(mockUser.id, 'rec-1');

      expect(result).toEqual({ message: '삭제 완료' });
      expect(prisma.recurringTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: 'rec-1', userId: mockUser.id, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('generateUpcomingTransactions', () => {
    it('creates transaction and updates account balance', async () => {
      jest.spyOn(service, 'shouldGenerateForToday').mockReturnValue(true);
      const recurring = {
        id: 'rec-1',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: null,
        categoryId: 'cat-1',
        type: TransactionType.expense,
        amount: 500,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: 'n',
        description: 'd',
      } as unknown as RecurringTransaction;

      (prisma.recurringTransaction.findMany as jest.Mock).mockResolvedValue([recurring]);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma as any));

      await service.generateUpcomingTransactions();

      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(recalculateAccountBalanceInTx).toHaveBeenCalledTimes(1);
    });

    it('updates both accounts for transfer', async () => {
      jest.spyOn(service, 'shouldGenerateForToday').mockReturnValue(true);
      const recurring = {
        id: 'rec-2',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: 'acc-002',
        categoryId: 'cat-1',
        type: TransactionType.transfer,
        amount: 100,
        startDate: '2024-01-01',
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: 'n',
        description: 'd',
      } as unknown as RecurringTransaction;

      (prisma.recurringTransaction.findMany as jest.Mock).mockResolvedValue([recurring]);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx' });
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma as any));

      await service.generateUpcomingTransactions();

      expect(prisma.transaction.create).toHaveBeenCalled();
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
    } as unknown as RecurringTransaction;

    it('returns true when allowDuplicates set', () => {
      const result = service.shouldGenerateForToday(base, new Date('2024-01-01'), { allowDuplicates: true });
      expect(result).toBe(true);
    });

    it('returns false if today is before start date', () => {
      const result = service.shouldGenerateForToday(base, new Date('2024-01-01'));
      expect(result).toBe(false);
    });

    it('returns false if anchor day does not match', () => {
      const result = service.shouldGenerateForToday(base, new Date('2024-01-06'));
      expect(result).toBe(false);
    });

    it('returns true when anchor day matches', () => {
      const result = service.shouldGenerateForToday(base, new Date('2024-02-05'));
      expect(result).toBe(true);
    });
  });
});