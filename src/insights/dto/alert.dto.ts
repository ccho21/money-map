import { ApiProperty } from '@nestjs/swagger';
import { InsightDTO } from './insight.dto';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';

export class AlertInsightResponseDTO {
  @ApiProperty({ type: [InsightDTO] })
  insights: InsightDTO[];

  @ApiProperty({ example: 'monthly' })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;
}
