import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class BudgetCategoryPeriodItemDTO {
  @ApiProperty({ example: '2024-04', description: '그룹 레이블 (월/주 등)' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2024-04-01', description: '그룹 시작일' })
  @IsString()
  rangeStart: string;

  @ApiProperty({ example: '2024-04-30', description: '그룹 종료일' })
  @IsString()
  rangeEnd: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsInt()
  used: number;

  @ApiProperty()
  @IsInt()
  remaining: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOver?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetId?: string | null;

  @ApiProperty()
  @IsBoolean()
  isCurrent: boolean;

  @ApiProperty()
  @IsBoolean()
  isUnconfigured: boolean;

  @ApiProperty()
  @IsString()
  type: CategoryType;
}
