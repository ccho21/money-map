import { GroupBy } from '@/common/types/types';
import { TransactionDetailDTO } from '@/transactions/dto/transaction-detail.dto';
import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
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
  groupBy: GroupBy,
  timezone: string,
  fixedRanges?: {
    label: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }[],
): TransactionGroupItemDTO[] {
  const grouped = new Map<
    string,
    {
      rangeStart: string;
      rangeEnd: string;
      transactions: TransactionDetailDTO[];
    }
  >();

  // ✅ 고정 구간이 있을 경우 미리 초기화
  if (fixedRanges) {
    for (const r of fixedRanges) {
      grouped.set(r.label, {
        rangeStart: r.startDate,
        rangeEnd: r.endDate,
        transactions: [],
      });
    }
  }

  for (const tx of transactions) {
    const zonedTx = toZonedTime(tx.date, timezone);
    let label: string;
    let rangeStart: Date;
    let rangeEnd: Date;

    switch (groupBy) {
      case GroupBy.DAILY:
        rangeStart = startOfDay(zonedTx);
        rangeEnd = endOfDay(zonedTx);
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case GroupBy.WEEKLY:
        rangeStart = startOfWeek(zonedTx, { weekStartsOn: 0 });
        rangeEnd = endOfWeek(zonedTx, { weekStartsOn: 0 });
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case GroupBy.MONTHLY:
        rangeStart = startOfMonth(zonedTx);
        rangeEnd = endOfMonth(zonedTx);
        label = format(rangeStart, 'yyyy-MM');
        break;
      case GroupBy.YEARLY:
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

    const dto: TransactionDetailDTO = {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note ?? '',
      description: tx.description ?? '',
      accountId: tx.accountId,
      toAccountId: tx.toAccountId ?? undefined,
      linkedTransferId: tx.linkedTransferId ?? undefined,
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

  const data: TransactionGroupItemDTO[] = [];
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
      totalIncome: income,
      totalExpense: expense,
      transactions,
    });
  }

  // ✅ 라벨 순 정렬 보장
  return data.sort((a, b) => a.rangeStart.localeCompare(b.rangeStart));
}
