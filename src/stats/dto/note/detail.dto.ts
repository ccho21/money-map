import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
import { ApiProperty } from '@nestjs/swagger';
export class StatsNoteDetailDTO {
  @ApiProperty()
  note: string;

  @ApiProperty()
  totalIncome: number;

  @ApiProperty()
  totalExpense: number;

  @ApiProperty({ type: [TransactionGroupItemDTO] })
  items: TransactionGroupItemDTO[];
}
