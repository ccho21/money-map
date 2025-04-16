import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsString } from 'class-validator';
import { BaseStatsItemDTO } from './base-stats-item.dto';

export class BudgetStatsItemDTO extends BaseStatsItemDTO {
  @ApiProperty()
  @IsString()
  icon: string;

  @ApiProperty()
  @IsString()
  color: string;

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
  @IsBoolean()
  hasBudget: boolean;
}
