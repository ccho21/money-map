import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { CreateBudgetCategoryDTO } from './budget-category.dto';

export class UpdateBudgetDto {
  @ApiPropertyOptional({ example: 600000, description: '수정할 총 예산' })
  @IsInt()
  total?: number;

  @ApiPropertyOptional({
    type: [String],
    description: '수정할 카테고리 ID 목록',
    example: ['cat001', 'cat002'],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetCategoryDTO)
  categories: CreateBudgetCategoryDTO[];
}
