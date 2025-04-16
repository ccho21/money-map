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

type FixedRange = {
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export function groupTransactions(
  transactions: GroupTransactionInput[],
  groupBy: GroupBy,
  timezone: string,
  fixedRanges?: FixedRange[],
): TransactionGroupItemDTO[] {
  const grouped = new Map<string, TransactionGroupItemDTO>();

  // ✅ 고정 구간 있을 경우 미리 생성
  if (fixedRanges) {
    for (const range of fixedRanges) {
      grouped.set(range.label, {
        label: range.label,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        groupIncome: 0,
        groupExpense: 0,
        transactions: [],
        isCurrent: range.isCurrent,
      });
    }
  }

  for (const tx of transactions) {
    const zoned = toZonedTime(tx.date, timezone);

    let rangeStart: Date;
    let rangeEnd: Date;
    let label: string;

    switch (groupBy) {
      case GroupBy.DAILY:
        rangeStart = startOfDay(zoned);
        rangeEnd = endOfDay(zoned);
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case GroupBy.WEEKLY:
        rangeStart = startOfWeek(zoned, { weekStartsOn: 0 });
        rangeEnd = endOfWeek(zoned, { weekStartsOn: 0 });
        label = format(rangeStart, 'yyyy-MM-dd');
        break;
      case GroupBy.MONTHLY:
        rangeStart = startOfMonth(zoned);
        rangeEnd = endOfMonth(zoned);
        label = format(rangeStart, 'yyyy-MM');
        break;
      case GroupBy.YEARLY:
        rangeStart = startOfYear(zoned);
        rangeEnd = endOfYear(zoned);
        label = format(rangeStart, 'yyyy');
        break;
      default:
        throw new Error('Invalid groupBy');
    }

    if (!grouped.has(label)) {
      grouped.set(label, {
        label,
        rangeStart: format(rangeStart, 'yyyy-MM-dd'),
        rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
        groupIncome: 0,
        groupExpense: 0,
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
          }
        : null,
      account: {
        id: tx.account.id,
        name: tx.account.name,
        type: tx.account.type,
        color: tx.account.color ?? '#999999',
      },
    };

    const group = grouped.get(label)!;
    group.transactions.push(dto);

    if (tx.type === 'income') {
      group.groupIncome += tx.amount;
    } else if (tx.type === 'expense') {
      group.groupExpense += tx.amount;
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.rangeStart.localeCompare(b.rangeStart),
  );
}
