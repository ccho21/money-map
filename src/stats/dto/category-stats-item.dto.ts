import { BaseStatsItemDTO } from './base-stats-item.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';

export class CategoryStatsItemDTO extends BaseStatsItemDTO {
  @ApiProperty()
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty()
  @IsString()
  color: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  budgetRate?: number;
}
