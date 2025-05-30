import { ApiExtraModels, ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsInt, IsUUID } from 'class-validator';

export class BaseBudgetCategoryRequestDTO {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}

@ApiExtraModels()
export class BudgetCategoryCreateRequestDTO extends BaseBudgetCategoryRequestDTO {}

export class BudgetCategoryUpdateRequestDTO extends PartialType(
  BudgetCategoryCreateRequestDTO,
) {}
