import { groupTransactions } from '@/stats/util/groupTransactions.util';
import { GroupBy } from '@/common/types/types';
import { CategoryType, TransactionType, AccountType } from '@prisma/client';

const timezone = 'America/Toronto';

const baseAccount = {
  id: 'acc-1',
  name: 'My Account',
  type: AccountType.CASH, // ✅ 문자열 "CASH" ❌ → enum 사용
  userId: 'user-123',
  description: 'My test account',
  createdAt: new Date(),
  updatedAt: new Date(),
  color: '#00f',
  balance: 100000,
  settlementDate: null,
  paymentDate: null,
  autoPayment: false,
};

const baseCategory = {
  id: 'cat-1',
  name: 'Food',
  icon: '🍔',
  userId: 'user-123',
  type: 'expense' as CategoryType,
  color: '#f00',
};

const baseTx = {
  id: 'tx-1',
  amount: 1000,
  type: TransactionType.income,
  note: 'Note',
  description: 'Desc',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  toAccountId: null,
  linkedTransferId: null,
  userId: 'user-123',
  isOpening: false,
  isTransfer: false,
  dueDate: null,
  paidAt: null,
  createdAt: new Date(),
  date: new Date(),
  account: baseAccount, // ✅ 완전한 account mock
  category: baseCategory,
};

describe('groupTransactions', () => {
  it('should group by daily', () => {
    const result = groupTransactions([baseTx], GroupBy.DAILY, timezone);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('2025-04-15');
    expect(result[0].incomeTotal).toBe(1000);
    expect(result[0].expenseTotal).toBe(0);
    expect(result[0].transactions).toHaveLength(1);
  });

  it('should group multiple tx by month', () => {
    const tx1 = {
      ...baseTx,
      id: 'tx-1',
      date: new Date('2024-01-05T10:00:00Z'),
    };
    const tx2 = {
      ...baseTx,
      id: 'tx-2',
      date: new Date('2024-02-10T10:00:00Z'),
      type: 'expense' as TransactionType,
    };
    const result = groupTransactions([tx1, tx2], GroupBy.MONTHLY, timezone);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.label === '2024-01')!.incomeTotal).toBe(1000);
    expect(result.find((g) => g.label === '2024-02')!.expenseTotal).toBe(1000);
  });

  it('should honor fixedRanges even with no tx', () => {
    const result = groupTransactions([], GroupBy.MONTHLY, timezone, [
      {
        label: '2024-03',
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        isCurrent: false,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('2024-03');
    expect(result[0].transactions).toHaveLength(0);
  });

  it('should calculate totals correctly for mixed types', () => {
    const txs = [
      { ...baseTx, type: 'income' as TransactionType, amount: 300 },
      { ...baseTx, type: 'expense' as TransactionType, amount: 200 },
      { ...baseTx, type: 'transfer' as TransactionType, amount: 100 }, // ignored
    ];
    const result = groupTransactions(txs, GroupBy.DAILY, timezone);
    expect(result[0].incomeTotal).toBe(300);
    expect(result[0].expenseTotal).toBe(200);
  });

  it('should return sorted result by rangeStart', () => {
    const txs = [
      {
        ...baseTx,
        id: 'tx-later',
        date: new Date('2024-03-15T10:00:00Z'),
      },
      {
        ...baseTx,
        id: 'tx-earlier',
        date: new Date('2024-01-15T10:00:00Z'),
      },
    ];

    const result = groupTransactions(txs, GroupBy.MONTHLY, timezone);
    expect(result[0].label).toBe('2024-01');
    expect(result[1].label).toBe('2024-03');
  });
});
