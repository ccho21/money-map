import { InsightDTO } from '@/insights/dto/insight.dto';
import { ApiProperty } from '@nestjs/swagger';

export class DashboardCategoryMonthlyDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  percent: number;

  @ApiProperty({ required: false })
  color?: string;
}

export class DashboardBudgetComparisonDTO {
  @ApiProperty()
  previousUsageRate: number;

  @ApiProperty()
  difference: number;

  @ApiProperty()
  percentChange: string;

  @ApiProperty({ enum: ['increase', 'decrease'] })
  trend: 'increase' | 'decrease';
}

export class DashboardMonthlyComparisonDTO {
  @ApiProperty()
  previousAmount: number;

  @ApiProperty()
  difference: number;

  @ApiProperty()
  percentChange: string;

  @ApiProperty({ enum: ['increase', 'decrease'] })
  trend: 'increase' | 'decrease';
}

export class DashboardBudgetDTO {
  @ApiProperty()
  used: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  usageRate: number;

  @ApiProperty({ type: DashboardBudgetComparisonDTO, required: false })
  comparison?: DashboardBudgetComparisonDTO;
}

export class DashboardMonthlySpendingDTO {
  @ApiProperty()
  amount: number;

  @ApiProperty({ type: DashboardMonthlyComparisonDTO, required: false })
  comparison?: DashboardMonthlyComparisonDTO;
}

export class DashboardDTO {
  @ApiProperty()
  balance: number;

  @ApiProperty({ type: DashboardBudgetDTO })
  budget: DashboardBudgetDTO;

  @ApiProperty({ type: DashboardMonthlySpendingDTO })
  monthlySpending: DashboardMonthlySpendingDTO;

  @ApiProperty({ type: [DashboardCategoryMonthlyDTO] })
  categoryMonthly: DashboardCategoryMonthlyDTO[];

  @ApiProperty({ type: [InsightDTO] })
  insights: InsightDTO[];
}
