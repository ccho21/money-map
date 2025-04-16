// 📁 src/stats/dto/budget/group-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseStatsItemDTO } from '../base/base-stats-item.dto';

export class BudgetStatsGroupItemDTO extends BaseStatsItemDTO {}

export class BudgetStatsItemDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  icon: string;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsInt()
  budget: number;

  @ApiProperty()
  @IsInt()
  spent: number;

  @ApiProperty()
  @IsInt()
  income: number;

  @ApiProperty()
  @IsInt()
  remaining: number;

  @ApiProperty()
  @IsNumber()
  rate: number;

  @ApiProperty()
  @IsBoolean()
  hasBudget: boolean;
}
