import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { GroupBy, Timeframe } from '../params/transaction-group-query.dto';

export class TransactionGroupSummaryDTO {
  @ApiProperty({
    example: 'weekly',
  })
  timeframe: Timeframe;

  @ApiProperty({
    example: 'weekly',
  })
  groupBy: GroupBy;

  @ApiProperty({ example: '2025-05-01' })
  startDate: string;

  @ApiProperty({ example: '2025-05-31' })
  endDate: string;

  @ApiProperty({ example: 300000 })
  totalIncome: number;

  @ApiProperty({ example: 170000 })
  totalExpense: number;

  @ApiProperty({ example: 130000 })
  netBalance: number;

  @ApiProperty({
    example: { difference: 25000, percent: '8.3' },
    required: false,
  })
  comparison?: {
    difference: number;
    percent: string;
  };

  @ApiProperty({
    example: {
      categoryId: 'c123',
      name: 'Food & Drink',
      icon: '🍔',
      amount: 52000,
      type: CategoryType.expense,
    },
    required: false,
  })
  topSpendingCategory?: {
    categoryId: string;
    name: string;
    icon: string;
    amount: number;
    type: CategoryType;
    color?: string; // optional
  };
}
