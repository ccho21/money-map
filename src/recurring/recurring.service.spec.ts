import { Test, TestingModule } from '@nestjs/testing';
import { RecurringService } from './recurring.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockAccount,
  mockUser,
} from '@/tests/mocks/mockHelpers';
import { RecurringFrequency, TransactionType } from '@prisma/client';

describe('RecurringService', () => {
  let service: RecurringService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUpcomingTransactions', () => {
    it('should create transaction and update balance', async () => {
      const recurring = {
        id: 'rec-1',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: null,
        categoryId: 'cat-1',
        type: TransactionType.expense,
        amount: 1000,
        startDate: new Date().toISOString(),
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: 'n',
        description: 'd',
      };

      (prisma.recurringTransaction.findMany as jest.Mock).mockResolvedValueOnce(
        [recurring],
      );
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.transaction.create as jest.Mock).mockResolvedValueOnce({
        id: 'tx',
      });
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma as any);
      });

      await service.generateUpcomingTransactions();

      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(prisma.account.update).toHaveBeenCalled();
    });

    it('should update both accounts for transfer', async () => {
      const recurring = {
        id: 'rec-2',
        userId: mockUser.id,
        accountId: mockAccount.id,
        toAccountId: 'acc-002',
        categoryId: 'cat-1',
        type: TransactionType.transfer,
        amount: 500,
        startDate: new Date().toISOString(),
        frequency: RecurringFrequency.daily,
        interval: 1,
        anchorDay: null,
        endDate: null,
        note: 'n',
        description: 'd',
      };

      (prisma.recurringTransaction.findMany as jest.Mock).mockResolvedValueOnce(
        [recurring],
      );
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.transaction.create as jest.Mock).mockResolvedValueOnce({
        id: 'tx',
      });
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.account.update as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma as any);
      });

      await service.generateUpcomingTransactions();

      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(prisma.account.update).toHaveBeenCalledTimes(2);
    });
  });
});
