import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CategoryType } from '@prisma/client';

export class BudgetCategoryGroupItemDTO {
  @ApiProperty({
    example: 'Apr',
    description: '해당 예산 기간의 레이블 (월 약어)',
  })
  @IsString()
  label: string;

  @ApiProperty({
    example: '2025-04-01',
    description: '해당 예산의 시작일 (YYYY-MM-DD)',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2025-04-30',
    description: '해당 예산의 종료일 (YYYY-MM-DD)',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 200, description: '해당 기간의 예산 금액' })
  @IsNumber()
  budgetAmount: number;

  @ApiProperty({ example: true, description: '현재 활성화된 기간 여부' })
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty({ example: 'abc123', description: '카테고리 ID' })
  @IsString()
  categoryId?: string | null;
}

export class BudgetCategoryGroupResponseDTO {
  @ApiProperty({ example: 'abc123', description: '카테고리 ID' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @IsString()
  categoryName: string;

  @ApiProperty({
    enum: CategoryType,
    example: 'expense',
    description: '카테고리 타입',
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: 'Utensils', description: '카테고리 아이콘' })
  @IsString()
  icon: string;

  @ApiProperty({
    example: '#FF0000',
    description: '카테고리 색상',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    type: [BudgetCategoryGroupItemDTO],
    description: '12개월 분할 예산 항목 리스트',
  })
  budgets: BudgetCategoryGroupItemDTO[];
}
