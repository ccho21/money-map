import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class StatsByBudget {
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
    example: 'Utensils',
    description: 'lucide-react 기준 아이콘 이름',
  })
  @IsString()
  icon: string;

  @ApiProperty({ example: '#FF8A00', description: '카테고리 색상' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 300000, description: '해당 카테고리에 설정된 예산' })
  @IsNumber()
  budget: number;

  @ApiProperty({ example: 150000, description: '지출된 금액' })
  @IsNumber()
  spent: number;

  @ApiProperty({ example: 150000, description: '남은 예산 (budget - spent)' })
  @IsNumber()
  remaining: number;

  @ApiProperty({
    example: 50.0,
    description: '지출 비율 (%) = (spent / budget) * 100, 예산 0이면 0%',
  })
  @IsNumber()
  rate: number;
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

  @ApiProperty({
    type: [StatsByBudget],
    description: '카테고리별 예산/지출/남은금액 + 사용률 정렬 리스트',
  })
  data: StatsByBudget[];
}
