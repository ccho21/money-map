import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

import { ApiExtraModels } from '@nestjs/swagger';
import { BaseCategoryDTO } from '@/common/dto/base-category.dto';

@ApiExtraModels()
export class CategoryCreateRequestDTO extends BaseCategoryDTO {}