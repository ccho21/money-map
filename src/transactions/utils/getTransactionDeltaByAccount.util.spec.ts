import { TransactionType } from '@prisma/client';
import { getTransactionDeltaByAccount } from './getTransactionDeltaByAccount.util';

describe('getTransactionDeltaByAccount', () => {
  const accountId = 'acc-001';

  it('should return +amount for income', () => {
    const delta = getTransactionDeltaByAccount(
      {
        type: TransactionType.income,
        amount: 5000,
        accountId,
      },
      accountId,
    );
    expect(delta).toBe(5000);
  });

  it('should return -amount for expense', () => {
    const delta = getTransactionDeltaByAccount(
      {
        type: TransactionType.expense,
        amount: 3000,
        accountId,
      },
      accountId,
    );
    expect(delta).toBe(-3000);
  });

  it('should return -amount for transfer outgoing', () => {
    const delta = getTransactionDeltaByAccount(
      {
        type: TransactionType.transfer,
        amount: 2000,
        accountId,
        toAccountId: 'acc-999',
      },
      accountId,
    );
    expect(delta).toBe(-2000);
  });

  it('should return +amount for transfer incoming', () => {
    const delta = getTransactionDeltaByAccount(
      {
        type: TransactionType.transfer,
        amount: 1500,
        accountId: 'acc-999',
        toAccountId: accountId,
      },
      accountId,
    );
    expect(delta).toBe(1500);
  });

  it('should return 0 for unrelated transaction', () => {
    const delta = getTransactionDeltaByAccount(
      {
        type: TransactionType.expense,
        amount: 1000,
        accountId: 'other-acc',
      },
      accountId,
    );
    expect(delta).toBe(0);
  });
});
