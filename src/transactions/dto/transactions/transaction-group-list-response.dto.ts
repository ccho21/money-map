import { ApiProperty } from '@nestjs/swagger';
import { TransactionGroupItemDTO } from './transaction-group-item.dto';
import { GroupBy, Timeframe } from '../params/transaction-group-query.dto';

export class TransactionGroupListResponseDTO {
  @ApiProperty({
    example: 'weekly',
  })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-07' })
  endDate: string;

  @ApiProperty({
    example: 'date',
    enum: ['date', 'category', 'account', 'tag', 'budget', 'note'],
  })
  groupBy: GroupBy;

  @ApiProperty({ type: [TransactionGroupItemDTO] })
  groups: TransactionGroupItemDTO[];
}
