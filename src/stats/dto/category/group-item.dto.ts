// 📁 src/stats/dto/category/group-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class StatsCategoryGroupItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categoryType: CategoryType;

  @ApiProperty()
  color: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  rate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budgetRate?: number;
}
