import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client'; // enum: 'income' | 'expense'

export class BudgetUsageDTO {
  @ApiProperty({ example: 'cat_food' })
  categoryId: string;

  @ApiProperty({ example: 'Food' })
  name: string;

  @ApiProperty({ example: '🍔' })
  icon: string;

  @ApiProperty({ example: 'expense', enum: ['income', 'expense'] })
  type: CategoryType;

  @ApiProperty({ example: 200000 })
  budget: number;

  @ApiProperty({ example: 250000 })
  used: number;

  @ApiProperty({ example: 50000 })
  over: number;

  @ApiProperty({ example: 0 })
  remaining: number;
}

export class TransactionChartBudgetDTO {
  @ApiProperty({
    example: 'monthly',
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
  })
  timeframe: string;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;

  @ApiProperty({ example: 500000 })
  totalBudget: number;

  @ApiProperty({ example: 620000 })
  totalUsed: number;

  @ApiProperty({ example: 124.0 })
  usageRate: number;

  @ApiProperty({ example: true })
  overBudget: boolean;

  @ApiProperty({ example: 2 })
  overCategoryCount: number;

  @ApiProperty({ type: [BudgetUsageDTO] })
  breakdown: BudgetUsageDTO[];
}
