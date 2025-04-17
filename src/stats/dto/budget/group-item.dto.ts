// 📁 src/Stats/dto/budget/group-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { BaseGroupItemDTO } from '@/common/dto/base-group-item.dto';

export class StatsBudgetGroupItemDTO extends BaseGroupItemDTO {
  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categoryType: CategoryType;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  spent: number;

  @ApiProperty()
  income: number;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  hasBudget: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  budgetId?: string;
}
