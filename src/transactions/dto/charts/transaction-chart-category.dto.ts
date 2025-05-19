import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client'; // 필요 시 enum 재정의 가능

export class CategorySpendingDTO {
  @ApiProperty({ example: 'cat_food_01' })
  categoryId: string;

  @ApiProperty({ example: 'Food' })
  name: string;

  @ApiProperty({ example: '🍔' })
  icon: string;

  @ApiProperty({ example: 3200 })
  amount: number;

  @ApiProperty({ example: 'expense', enum: ['income', 'expense'] })
  type: CategoryType;

  @ApiProperty({ example: '#FFA500', required: false })
  color?: string;
}

export class CategoryComparisonDTO {
  @ApiProperty({ example: 'cat_food_01' })
  categoryId: string;

  @ApiProperty({ example: 'Food' })
  name: string;

  @ApiProperty({ example: 3200 })
  current: number;

  @ApiProperty({ example: 2850 })
  previous: number;

  @ApiProperty({ example: 350 })
  difference: number;

  @ApiProperty({ example: '12.3%' })
  percentChange: string;

  @ApiProperty({ example: 'increase', enum: ['increase', 'decrease'] })
  trend: 'increase' | 'decrease';
}

export class TransactionChartCategoryDTO {
  @ApiProperty({ example: 'monthly', enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'] })
  timeframe: string;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;

  @ApiProperty({ type: [CategorySpendingDTO] })
  topCategories: CategorySpendingDTO[];

  @ApiProperty({ type: CategoryComparisonDTO })
  comparison?: CategoryComparisonDTO;
}