import { TransactionType } from '@prisma/client';
import { PrismaTransactionClient } from './recalculateAccountBalanceInTx.util';

export const recalculateAccountBalanceInTx = async (
  tx: PrismaTransactionClient,
  accountId: string,
): Promise<void> => {
  const transactions = await tx.transaction.findMany({
    where: {
      OR: [
        { accountId },
        { toAccountId: accountId }, // transfer 입금
      ],
      isOpening: false,
    },
  });

  const balance = transactions.reduce((acc, tx) => {
    if (tx.type === TransactionType.income && tx.accountId === accountId) return acc + tx.amount;
    if (tx.type === TransactionType.expense && tx.accountId === accountId) return acc - tx.amount;

    if (tx.type === TransactionType.transfer) {
      if (tx.accountId === accountId) return acc - tx.amount; // 출금
      if (tx.toAccountId === accountId) return acc + tx.amount; // 입금
    }

    return acc;
  }, 0);

  await tx.account.update({
    where: { id: accountId },
    data: { balance },
  });
};
