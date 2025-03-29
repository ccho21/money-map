import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  icon: string;
}

export class CategoryDto {
  @ApiProperty({ example: 'abc123', description: '카테고리 ID' })
  id: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  name: string;

  @ApiProperty({ example: '🍔', description: '카테고리 아이콘' })
  icon: string;
}
