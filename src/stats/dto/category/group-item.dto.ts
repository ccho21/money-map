// 📁 src/stats/dto/category/group-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsString, IsUUID } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseStatsItemDTO } from '../base/base-stats-item.dto';

export class CategoryStatsGroupItemDTO extends BaseStatsItemDTO {}

export class CategoryStatsItemDTO {
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
  color: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiProperty()
  @IsNumber()
  rate: number;

  @ApiPropertyOptional()
  @IsUUID()
  budgetId?: string;

  @ApiPropertyOptional()
  @IsInt()
  budget?: number;

  @ApiPropertyOptional()
  @IsNumber()
  budgetRate?: number;
}
