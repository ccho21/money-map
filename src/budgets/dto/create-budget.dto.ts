import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsNotEmpty,
  Min,
  IsDateString,
} from 'class-validator';

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
