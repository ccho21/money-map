import { TransactionType } from '@prisma/client';

export const getTransactionDelta = (
  tx: {
    type: TransactionType;
    amount: number;
    accountId: string;
    toAccountId?: string | null;
  },
  targetAccountId: string,
): number => {
  if (tx.type === 'expense' && tx.accountId === targetAccountId)
    return -tx.amount;

  if (tx.type === 'income' && tx.accountId === targetAccountId)
    return tx.amount;

  if (tx.type === 'transfer') {
    if (tx.accountId === targetAccountId && tx.toAccountId) return -tx.amount; // 출금
    if (tx.accountId === targetAccountId && !tx.toAccountId) return tx.amount; // 입금 (linked)
    if (tx.toAccountId === targetAccountId) return tx.amount; // 입금
  }

  return 0;
};
