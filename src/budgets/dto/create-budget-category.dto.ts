import { IsUUID, IsInt } from 'class-validator';

export class CreateBudgetCategoryDto {
  @IsUUID()
  categoryId: string;

  @IsInt()
  amount: number;
}
