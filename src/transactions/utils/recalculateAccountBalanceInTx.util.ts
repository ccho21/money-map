import { Prisma } from '@prisma/client';

export const recalculateAccountBalanceInTx = async (
  tx: Prisma.TransactionClient,
  accountId: string,
) => {
  const transactions = await tx.transaction.findMany({
    where: {
      OR: [{ accountId }, { toAccountId: accountId }],
    },
  });

  let balance = 0;

  for (const tx of transactions) {
    if (tx.type === 'income' && tx.accountId === accountId) {
      balance += tx.amount;
    } else if (tx.type === 'expense' && tx.accountId === accountId) {
      balance -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId && tx.toAccountId) {
        // 출금 트랜스퍼
        balance -= tx.amount;
      } else if (tx.toAccountId === accountId) {
        // 입금 트랜스퍼
        balance += tx.amount;
      }
    }
  }

  await tx.account.update({
    where: { id: accountId },
    data: { balance },
  });

  return balance;
};
