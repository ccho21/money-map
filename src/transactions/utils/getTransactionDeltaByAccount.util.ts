import { TransactionType } from '@prisma/client';

interface TransactionLike {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
}

/**
 * 특정 계좌 기준 입출금 방향성을 반영한 delta 금액 계산
 * - 출금(계좌에서 빠져나감): 음수
 * - 입금(계좌로 들어옴): 양수
 * - 관련 없음: 0
 */
export const getTransactionDeltaByAccount = (
  tx: TransactionLike,
  accountId: string,
): number => {
  if (tx.type === 'income' && tx.accountId === accountId) return tx.amount;
  if (tx.type === 'expense' && tx.accountId === accountId) return -tx.amount;
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) return -tx.amount; // 출금
    if (tx.toAccountId === accountId) return tx.amount; // 입금
  }
  return 0;
};
