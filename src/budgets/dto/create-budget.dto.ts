import { IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBudgetCategoryDto } from './create-budget-category.dto';

export class CreateBudgetDto {
  @IsInt()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetCategoryDto)
  categories: CreateBudgetCategoryDto[];
}
