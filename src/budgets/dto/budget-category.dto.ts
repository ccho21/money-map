import { CategoryType } from '@prisma/client';

import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class BudgetCategoryDTO {
  @ApiProperty({ example: 'cat001' })
  categoryId: string;

  @ApiProperty({ example: '식비' })
  categoryName: string;

  @ApiProperty({ enum: ['income', 'expense'], example: 'expense' })
  type: CategoryType;

  @ApiProperty({ example: 'Utensils' })
  icon: string;

  @ApiProperty({ example: '#FF0000', required: false })
  color?: string;

  @ApiProperty({ example: 'budgetcat123', nullable: true })
  budgetId: string | null;

  @ApiProperty({ example: 300000 })
  budgetAmount: number;

  @ApiProperty({ example: '2025-04-01' })
  startDate: string;

  @ApiProperty({ example: '2025-04-30' })
  endDate: string;

  @ApiProperty({ example: true })
  isNew: boolean;
}

export class BudgetCategoryListDTO {
  @ApiProperty({ example: 1200000 })
  total: number;

  @ApiProperty({ type: [BudgetCategoryDTO] })
  data: BudgetCategoryDTO[];
}

export class UpdateBudgetCategoryDTO {
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateBudgetCategoryResponseDTO {
  @ApiProperty({ example: 'budgetcat123' })
  budgetId: string;

  @ApiProperty({ example: 'Budget updated successfully.' })
  message: string;
}

export class CreateBudgetCategoryDTO {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class CreateBudgetCategoryResponseDTO {
  @ApiProperty({ example: 'budgetcat123' })
  budgetId: string;

  @ApiProperty({ example: 'Budget created successfully.' })
  message: string;
}
