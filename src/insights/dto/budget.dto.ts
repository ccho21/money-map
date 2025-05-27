import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';
import { ChartDataItem } from './chart-item.dto';
import { InsightDTO } from './insight.dto';
import { ApiProperty } from '@nestjs/swagger';

export class BudgetInsightResponseDTO {
  insights: InsightDTO[];
  byCategory: ChartDataItem; // getCategorySpendingSummary → toChartDataItem()

  @ApiProperty({ example: 'monthly' })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;
}
