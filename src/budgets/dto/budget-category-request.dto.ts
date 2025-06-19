import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsUUID } from 'class-validator';

export class BaseBudgetCategoryRequestDTO {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  amount: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}

export class BudgetCategoryCreateRequestDTO extends BaseBudgetCategoryRequestDTO {}

export class BudgetCategoryUpdateRequestDTO extends PartialType(
  BudgetCategoryCreateRequestDTO,
) {}
