import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';
import { ChartDataItem } from './chart-item.dto';
import { InsightDTO } from './insight.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ChartDataDTO {
  @ApiProperty({ example: { Mon: 12000, Tue: 9000, Wed: 15000 } })
  byDay: Record<string, number>;

  @ApiProperty({
    example: { '00–06': 3200, '06–12': 5200, '12–18': 7800, '18–24': 14200 },
  })
  byTime: Record<string, number>;
}

export class PatternInsightResponseDTO {
  @ApiProperty({ type: [InsightDTO] })
  insights: InsightDTO[];

  @ApiProperty({ type: ChartDataItem })
  byDay: ChartDataItem;

  @ApiProperty({ type: ChartDataItem })
  byTime: ChartDataItem;

  @ApiProperty({ example: 'monthly' })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;
}
