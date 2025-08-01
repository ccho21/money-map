import { TransactionType } from '@prisma/client';

export class TransactionItemDTO {
  id: string;
  note?: string | null;
  description?: string | null;
  amount: number;
  payment: string;
  date: string; // ISO8601 string (e.g., '2025-05-01T14:32:00.000Z')
  type: TransactionType;
  recurringId?: string | null;
  category?: {
    name: string;
    icon: string;
    color: string;
  } | null;
  account: {
    name: string;
  };

  /**
   * Optional running balance for the related account after this transaction.
   */
  balanceAfter?: number;
}
