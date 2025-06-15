import { AccountDetailDTO } from '@/accounts/dto/account-detail.dto';
import { CategoryDetailDTO } from '@/categories/dto/category-detail.dto';
import { TransactionDetailDTO } from '@/transactions/dto/transactions/transaction-detail.dto';
import { Account, Category, Transaction } from '@prisma/client';

/**
 * 계좌 정보 매핑 (Account → AccountDetailDTO)
 */
export function mapAccountToDTO(account: Account): AccountDetailDTO {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    color: account.color ?? null,
    description: account.description ?? null,
    settlementDate: account.settlementDate ?? null,
    paymentDate: account.paymentDate ?? null,
    autoPayment: account.autoPayment ?? null,
  };
}

/**
 * 카테고리 정보 매핑 (Category → CategoryDetailDTO)
 */
export function mapCategoryToDTO(category: Category): CategoryDetailDTO {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    type: category.type,
    color: category.color ?? '',
  };
}

/**
 * 트랜잭션 상세 정보 매핑 (Transaction + joins → TransactionDetailDTO)
 */
export function mapTransactionToDTO(
  tx: Transaction & {
    category?: Category | null;
    account: Account;
    toAccount?: Account | null;
  },
): TransactionDetailDTO {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId ?? null,
    linkedTransferId: tx.linkedTransferId ?? null,
    date: tx.date.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    note: tx.note ?? '',
    description: tx.description ?? '',
    category: tx.category ? mapCategoryToDTO(tx.category) : null,
    account: mapAccountToDTO(tx.account),
    toAccount: tx.toAccount ? mapAccountToDTO(tx.toAccount) : null,
    dueDate: tx.dueDate ? tx.dueDate.toISOString() : null,
    paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
  };
}
