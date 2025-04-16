import { PartialType } from '@nestjs/swagger';
import { CategoryCreateRequestDTO } from './category-create-request.dto';

export class CategoryUpdateRequestDTO extends PartialType(CategoryCreateRequestDTO) {}
