import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class StatsByCategory {
  @ApiProperty({
    example: 'cl3m2kxyd0000vavfb2gnxr4m',
    description: '카테고리 ID',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @IsString()
  categoryName: string;

  @IsEnum(CategoryType)
  categoryType: CategoryType; // income 또는 expense 구분

  @ApiProperty({
    example: 300000,
    description: '예산 금액 (해당 카테고리의 설정된 Budget)',
  })
  @IsNumber()
  budget: number;

  @ApiProperty({ example: 150000, description: '실제 지출된 금액' })
  @IsNumber()
  spent: number;

  @ApiProperty({ example: 150000, description: '남은 예산 (budget - spent)' })
  @IsNumber()
  remaining: number;

  @ApiProperty({
    example: 50.0,
    description: '지출 비율 (%) = spent / budget * 100',
  })
  @IsNumber()
  rate: number;

  @ApiProperty({ example: '#FF8A00', description: '카테고리 색상' })
  @IsString()
  @IsOptional()
  color?: string;
}

export class StatsByCategoryDTO {
  @ApiProperty({
    type: [StatsByCategory],
    description: '카테고리별 통계 목록',
  })
  data: StatsByCategory[];

  @ApiProperty({
    example: 1200000,
    description: '총 수입 금액 (income 카테고리 합계)',
  })
  @IsNumber()
  totalIncome: number;

  @ApiProperty({
    example: 850000,
    description: '총 지출 금액 (expense 카테고리 합계)',
  })
  @IsNumber()
  totalExpense: number;
}
