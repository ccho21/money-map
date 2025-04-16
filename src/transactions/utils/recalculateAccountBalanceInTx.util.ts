import { PrismaClient, TransactionType } from '@prisma/client';
export type PrismaTransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];

/**
 * 계좌의 잔액을 재계산하여 반영합니다.
 * - 수입: +
 * - 지출: -
 * - 이체: 차감/추가 (상대 계좌에 따라 반영)
 */
export const recalculateAccountBalanceInTx = async (
  tx: PrismaTransactionClient,
  accountId: string,
  userId: string,
): Promise<void> => {
  const transactions = await tx.transaction.findMany({
    where: {
      accountId,
      userId,
      isOpening: false,
    },
  });

  const balance = transactions.reduce((acc, tx) => {
    if (tx.type === TransactionType.income) return acc + tx.amount;
    if (tx.type === TransactionType.expense) return acc - tx.amount;
    return acc; // transfer는 from/to로 나뉘어 있기 때문에 여기선 무시 (계좌 2개 기준 따로 처리됨)
  }, 0);

  await tx.account.update({
    where: { id: accountId },
    data: { balance },
  });
};
