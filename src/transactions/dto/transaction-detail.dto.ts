export class TransactionDto {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: {
    id: string;
    name: string;
    icon: string;
  };
  note?: string;
  //   paymentMethod?: string;
  date: string; // ISO 문자열로 반환
}

export class DetailDataDto {
  incomeTotal: number;
  expenseTotal: number;
  transactions: TransactionDto[];
}
