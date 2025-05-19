import { GroupBy } from '../params/transaction-group-query.dto';
import { TransactionItemDTO } from './transaction-item.dto';

export class TransactionGroupItemDTO {
  groupBy: GroupBy;
  groupKey: string; // 묶인 값: 날짜 or 이름
  totalAmount: number;
  transactions: TransactionItemDTO[];
}
