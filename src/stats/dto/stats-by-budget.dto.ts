import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class StatsByBudget {
  @ApiProperty({
    example: 'f839b5d5-1635-4079-8cf3-4d432b734127',
    description: '카테고리 ID (total의 경우 "total")',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    example: 'cl3m2kxyd0000vavfb2gnxr4m',
    description: '예산 카테고리 ID (budgetCategoryId)',
    required: false,
  })
  @IsOptional()
  @IsString()
  budgetId?: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @IsString()
  categoryName: string;

  @ApiProperty({
    enum: CategoryType,
    example: 'expense',
    description: '카테고리 타입',
  })
  @IsEnum(CategoryType)
  categoryType: CategoryType;

  @ApiProperty({
    example: 'Utensils',
    description: 'lucide-react 아이콘 이름',
  })
  @IsString()
  icon: string;

  @ApiProperty({ example: '#F97316', description: '카테고리 색상 (선택)' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 300000, description: '설정된 예산' })
  @IsNumber()
  budget: number;

  @ApiProperty({ example: 150000, description: '실제 지출' })
  @IsNumber()
  spent: number;

  @ApiProperty({ example: 150000, description: '남은 예산 (budget - spent)' })
  @IsNumber()
  remaining: number;

  @ApiProperty({ example: 50.0, description: '사용률 (%)' })
  @IsNumber()
  rate: number;

  @ApiProperty({ example: true, description: '예산 설정 여부' })
  @IsOptional()
  hasBudget?: boolean;
}

export class StatsByBudgetDTO {
  @ApiProperty({ example: 3000000, description: '전체 예산 합계' })
  @IsNumber()
  totalBudget: number;

  @ApiProperty({ example: 1750000, description: '전체 지출 합계' })
  @IsNumber()
  totalSpent: number;

  @ApiProperty({ example: 1250000, description: '전체 남은 예산' })
  @IsNumber()
  totalRemaining: number;

  @ApiProperty({ example: '2025-04-01', description: '조회 시작일' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2025-04-30', description: '조회 종료일' })
  @IsString()
  endDate: string;

  @ApiProperty({
    type: [StatsByBudget],
    description: '카테고리별 예산/지출/남은금액 + 사용률 정렬 리스트',
  })
  data: StatsByBudget[];
}
