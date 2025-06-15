// 📁 insights/dto/recurring-insight-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';
import { InsightDTO } from './insight.dto';
import { ChartDataItem } from './chart-item.dto';

export class RecurringInsightResponseDTO {
  @ApiProperty({
    type: [InsightDTO],
    description: 'List of recurring-related insights (increase, drop, etc.)',
  })
  insights: InsightDTO[];

  @ApiProperty({
    type: ChartDataItem,
    description: 'Grouped recurring expense data formatted for chart display',
  })
  recurringSummary: ChartDataItem;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'weekly', 'custom'] })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;
}
