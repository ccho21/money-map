import { recalculateAccountBalanceInTx } from './recalculateAccountBalanceInTx.util';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory, mockAccount } from '@/mocks/mockHelpers';
import { TransactionType, Transaction } from '@prisma/client';

describe('recalculateAccountBalanceInTx', () => {
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = mockPrismaFactory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly calculate income, expense, and transfer transactions', async () => {
    const testAccountId = mockAccount.id;
    const testUserId = mockAccount.userId;

    const txSpy = jest.spyOn(prisma.transaction, 'findMany');
    const accountSpy = jest.spyOn(prisma.account, 'update');

    // Balance = 10000 (income) - 3000 - 5000 (expenses) + 1000 (transfer in) = 3000
    txSpy.mockResolvedValue([
      { amount: 10000, type: TransactionType.income, isOpening: false },
      { amount: 3000, type: TransactionType.expense, isOpening: false },
      { amount: 5000, type: TransactionType.expense, isOpening: false },
      { amount: 1000, type: TransactionType.transfer, isOpening: false },
    ] as unknown as Transaction[]);

    accountSpy.mockResolvedValue({
      ...mockAccount,
      balance: 3000,
    });

    await recalculateAccountBalanceInTx(prisma, testAccountId, testUserId);

    expect(txSpy).toHaveBeenCalledWith({
      where: {
        accountId: testAccountId,
        userId: testUserId,
        isOpening: false,
        deletedAt: null,
      },
    });

    expect(accountSpy).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { balance: 3000 },
    });
  });

  it('should calculate 0 balance when no valid transactions', async () => {
    const txSpy = jest.spyOn(prisma.transaction, 'findMany');
    const accountSpy = jest.spyOn(prisma.account, 'update');

    txSpy.mockResolvedValue([]);

    await recalculateAccountBalanceInTx(prisma, 'acc-999', 'user-999');

    expect(accountSpy).toHaveBeenCalledWith({
      where: { id: 'acc-999' },
      data: { balance: 0 },
    });
  });
});
