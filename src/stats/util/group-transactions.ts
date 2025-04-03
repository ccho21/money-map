import {
  TransactionDTO,
  TransactionSummary,
} from '@/transactions/dto/transaction.dto';
import { Account, Category, Transaction } from '@prisma/client';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

type GroupTransactionInput = Transaction & {
  account: Account;
  category: Category | null;
  toAccount?: Account | null;
};

export function groupTransactions(
  transactions: GroupTransactionInput[],
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly',
  timezone: string,
): TransactionSummary[] {
  const grouped = new Map<
    string,
    { rangeStart: string; rangeEnd: string; transactions: TransactionDTO[] }
  >();

  for (const tx of transactions) {
    const zonedTx = toZonedTime(tx.date, timezone);
    let label: string;
    let rangeStart: Date;
    let rangeEnd: Date;

    switch (groupBy) {
      case 'daily':
        rangeStart = startOfDay(zonedTx);
        rangeEnd = endOfDay(zonedTx);
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case 'weekly':
        rangeStart = startOfWeek(zonedTx, { weekStartsOn: 0 });
        rangeEnd = endOfWeek(zonedTx, { weekStartsOn: 0 });
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case 'monthly':
        rangeStart = startOfMonth(zonedTx);
        rangeEnd = endOfMonth(zonedTx);
        label = format(rangeStart, 'yyyy-MM');
        break;
      case 'yearly':
        rangeStart = startOfYear(zonedTx);
        rangeEnd = endOfYear(zonedTx);
        label = format(rangeStart, 'yyyy');
        break;
      default:
        throw new Error('Invalid groupBy');
    }

    if (!grouped.has(label)) {
      grouped.set(label, {
        rangeStart: format(rangeStart, 'yyyy-MM-dd'),
        rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
        transactions: [],
      });
    }

    const dto: TransactionDTO = {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note ?? '',
      description: tx.description ?? '',
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? undefined,
      linkedTransferId: tx.linkedTransferId ?? undefined,
      date: tx.date.toISOString(),
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
        color: tx.account.color ?? undefined,
      },
      toAccount: tx.toAccount
        ? {
            id: tx.toAccount.id,
            name: tx.toAccount.name,
            type: tx.toAccount.type,
            color: tx.toAccount.color ?? undefined,
          }
        : undefined,
    };

    grouped.get(label)!.transactions.push(dto);
  }

  const data: TransactionSummary[] = [];
  for (const [label, { rangeStart, rangeEnd, transactions }] of grouped) {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    data.push({
      label,
      rangeStart,
      rangeEnd,
      incomeTotal: income,
      expenseTotal: expense,
      transactions,
    });
  }

  return data;
}
