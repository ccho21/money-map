import { CategoryDTO } from '@/categories/dto/category.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, IsUUID } from 'class-validator';

export class BudgetDTO {
  @ApiProperty({ example: 'budget001', description: '예산 ID' })
  id: string;

  @ApiProperty({ example: 500000, description: '총 예산 금액' })
  @IsInt()
  total: number;

  @ApiProperty({
    example: ['cat001', 'cat002'],
    description: '연결된 카테고리 ID 목록',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];

  @ApiProperty({ example: '2025-04-01T12:00:00.000Z', description: '생성일' })
  createdAt: string;

  @ApiProperty({ example: '2025-04-02T09:00:00.000Z', description: '수정일' })
  updatedAt: string;
}

export class BudgetSummary {
  @ApiProperty({ example: 'cat001', description: '카테고리 ID' })
  categoryId: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  categoryName: string;

  @ApiProperty({ example: 300000, description: '설정된 예산 금액' })
  budgetAmount: number;

  @ApiProperty({ example: 120000, description: '실제 사용된 금액' })
  usedAmount: number;

  @ApiProperty({ example: 40, description: '예산 사용률 (%)' })
  rate: number;
}

export class BudgetSummaryDTO {
  @ApiProperty({ example: 1000000, description: '총 예산' })
  totalBudget: number;

  @ApiProperty({ example: 400000, description: '총 지출' })
  totalExpense: number;

  @ApiProperty({ example: 40, description: '예산 사용률 (%)' })
  rate: number;

  rangeStart: string; // 2025-03-01
  rangeEnd: string; // 2025-03-31
}
