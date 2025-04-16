import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class BudgetCategoryItemDTO {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  categoryName: string;

  @ApiProperty()
  @IsString()
  icon: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsInt()
  used: number;

  @ApiProperty()
  @IsInt()
  remaining: number;

  @ApiProperty()
  @IsBoolean()
  isOver: boolean;

  @ApiProperty()
  @IsString()
  type: CategoryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetId?: string;
}
