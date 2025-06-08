import { Transaction } from '@prisma/client';
import { TransactionItemDTO } from '../dto/transactions/transaction-item.dto';
import { CategoryDetailDTO } from '@/categories/dto/category-detail.dto';
import { AccountDetailDTO } from '@/accounts/dto/account-detail.dto';
import { TransactionDetailDTO } from '../dto/transactions/transaction-detail.dto';

export const convertToTransactionDetailDTO = (
  tx: Transaction & {
    category?: CategoryDetailDTO | null;
    account: AccountDetailDTO;
    toAccount?: AccountDetailDTO | null;
  },
): TransactionDetailDTO => {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    note: tx.note ?? '',
    description: tx.description ?? '',
    accountId: tx.accountId,
    toAccountId: tx.toAccountId ?? null,
    linkedTransferId: tx.linkedTransferId ?? null,
    date: tx.date.toISOString(),
    createdAt: tx.createdAt.toISOString(),

    category: tx.category
      ? {
          id: tx.category.id,
          name: tx.category.name,
          icon: tx.category.icon,
          type: tx.category.type,
          color: tx.category.color ?? '',
        }
      : undefined,

    account: {
      id: tx.account.id,
      name: tx.account.name,
      type: tx.account.type,
      balance: tx.account.balance,
      color: tx.account.color ?? null,
    },

    toAccount: tx.toAccount
      ? {
          id: tx.toAccount.id,
          name: tx.toAccount.name,
          type: tx.toAccount.type,
          balance: tx.toAccount.balance,
          color: tx.toAccount.color ?? null,
        }
      : undefined,
  };
};

export const convertToTransactionItemDTO = (
  tx: Transaction & {
    category?: {
      name: string;
      icon: string;
      color: string | null;
    } | null;
    account: { name: string };
  },
  balanceAfter?: number, // ✨ 추가
): TransactionItemDTO => {
  return {
    id: tx.id,
    note: tx.note,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    date: tx.date.toISOString(),
    payment: tx.account.name,
    recurringId: tx.recurringTransactionId,
    balanceAfter, // ✨ 추가
    category: tx.category
      ? {
          name: tx.category.name,
          icon: tx.category.icon,
          color: tx.category.color ?? '#d1d5db',
        }
      : {
          name: 'Uncategorized',
          icon: '',
          color: '#d1d5db',
        },
    account: {
      name: tx.account.name,
    },
  };
};
