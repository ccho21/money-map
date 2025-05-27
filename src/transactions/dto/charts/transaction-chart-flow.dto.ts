import { ApiProperty } from '@nestjs/swagger';
import { Timeframe } from '../params/transaction-group-query.dto';
import { InsightDTO } from '@/insights/dto/insight.dto';

export class PeriodDataDTO {
  @ApiProperty({
    example: 'January',
    description: '기간 라벨 (월, 주, 일 단위)',
  })
  period: string;

  @ApiProperty({ example: 3200000 })
  income: number;

  @ApiProperty({ example: 2400000 })
  expense: number;

  @ApiProperty({ example: 800000, description: '저축 금액 = income - expense' })
  saved: number;

  @ApiProperty({ example: 25.0, description: '저축 비율 (%)' })
  rate: number;
}

export class TransactionChartFlowDTO {
  @ApiProperty({
    example: 'monthly',
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
  })
  timeframe: Timeframe;

  @ApiProperty({ example: '2025-01-01' })
  startDate: string;

  @ApiProperty({ example: '2025-12-31' })
  endDate: string;

  @ApiProperty({ example: '이번 분기 지출이 18% 증가했어요' })
  insights: InsightDTO[];

  @ApiProperty({ type: [PeriodDataDTO] })
  periods: PeriodDataDTO[];
}
