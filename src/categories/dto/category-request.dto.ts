import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class BaseCategoryDTO {
  @ApiProperty({ example: 'Food' })
  @IsString()
  name: string;

  @ApiProperty({ example: '🍔' })
  @IsString()
  icon: string;

  @ApiProperty({ example: '#FF6600', required: false })
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  type: CategoryType;
}

@ApiExtraModels()
export class CategoryCreateRequestDTO extends BaseCategoryDTO {}

export class CategoryUpdateRequestDTO extends PartialType(
  CategoryCreateRequestDTO,
) {}
