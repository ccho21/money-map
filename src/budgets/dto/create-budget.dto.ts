import { Type } from 'class-transformer';
import { IsInt, IsArray, ValidateNested, IsUUID } from 'class-validator';

export class CreateBudgetCategoryDTO {
  @IsUUID()
  categoryId: string;

  @IsInt()
  amount: number;
}

export class CreateBudgetDTO {
  @IsInt()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetCategoryDTO)
  categories: CreateBudgetCategoryDTO[];
}
