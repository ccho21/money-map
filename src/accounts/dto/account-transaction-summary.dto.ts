import { TransactionDTO } from 'src/transactions/dto/transaction.dto';

export class AccountTransactionSummaryDTO {
  accountId: string;
  accountName: string;
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDTO[];
}
