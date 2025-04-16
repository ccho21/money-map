import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BudgetCategoryPeriodItemDTO } from './budget-category-period-item.dto';

export class BudgetGroupItemDTO {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  categoryName: string;

  @ApiProperty()
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty()
  @IsString()
  icon: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty()
  @IsNumber()
  totalBudget: number;

  @ApiProperty()
  @IsNumber()
  totalUsed: number;

  @ApiProperty()
  @IsNumber()
  totalRemaining: number;

  @ApiProperty()
  @IsBoolean()
  isOver: boolean;

  @ApiProperty({ type: [BudgetCategoryPeriodItemDTO] })
  @IsArray()
  budgets: BudgetCategoryPeriodItemDTO[];
}
