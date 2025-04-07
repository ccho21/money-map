import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const recalculateAccountBalanceInTx = async (
  tx: Prisma.TransactionClient,
  accountId: string,
): Promise<number> => {
  const account = await tx.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new NotFoundException('계좌를 찾을 수 없습니다.');
  }

  const transactions = await tx.transaction.findMany({
    where: {
      OR: [
        { accountId },
        { toAccountId: accountId }, // 입금용 transfer도 포함
      ],
    },
  });

  let newBalance = 0;

  for (const txItem of transactions) {
    const { type, amount } = txItem;

    if (type === 'income' && txItem.accountId === accountId) {
      newBalance += amount;
    } else if (type === 'expense' && txItem.accountId === accountId) {
      newBalance -= amount;
    } else if (type === 'transfer') {
      if (txItem.accountId === accountId && txItem.toAccountId) {
        // 출금 → 마이너스
        newBalance -= amount;
      } else if (txItem.toAccountId === accountId) {
        // 입금 → 플러스
        newBalance += amount;
      }
    }
  }

  // ✅ DB에 최신 balance 반영
  await tx.account.update({
    where: { id: accountId },
    data: { balance: newBalance },
  });

  return newBalance;
};
