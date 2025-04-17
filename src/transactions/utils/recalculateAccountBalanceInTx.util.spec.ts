import { recalculateAccountBalanceInTx } from './recalculateAccountBalanceInTx.util';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory, mockAccount } from '@/tests/mocks/mockHelpers';
import { TransactionType } from '@prisma/client';

describe('recalculateAccountBalanceInTx', () => {
  let tx: jest.Mocked<PrismaService>;

  beforeEach(() => {
    tx = mockPrismaFactory();
  });

  it('should correctly calculate income and expense transactions', async () => {
    const testAccountId = mockAccount.id;
    const testUserId = mockAccount.userId;

    (tx.transaction.findMany as jest.Mock).mockResolvedValue([
      { amount: 10000, type: TransactionType.income, isOpening: false },
      { amount: 3000, type: TransactionType.expense, isOpening: false },
      { amount: 5000, type: TransactionType.expense, isOpening: false },
      { amount: 1000, type: TransactionType.transfer, isOpening: false },
      // ❌ 이거 제거하거나 isOpening: false로 바꿔야 함
      // { amount: 999, type: TransactionType.income, isOpening: true },
    ]);

    (tx.account.update as jest.Mock).mockResolvedValue({
      ...mockAccount,
      balance: 2000, // expected: 10000 - 3000 - 5000 = 2000
    });

    await recalculateAccountBalanceInTx(tx, testAccountId, testUserId);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(tx.transaction.findMany).toHaveBeenCalledWith({
      where: {
        accountId: testAccountId,
        userId: testUserId,
        isOpening: false,
      },
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: testAccountId },
      data: { balance: 2000 },
    });
  });

  it('should calculate 0 balance when no valid transactions', async () => {
    (tx.transaction.findMany as jest.Mock).mockResolvedValue([]);

    await recalculateAccountBalanceInTx(tx, 'acc-999', 'user-999');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-999' },
      data: { balance: 0 },
    });
  });
});
