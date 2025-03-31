import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

export class UpdateCategoryDto {
  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'expense',
    enum: ['income', 'expense'],
    description: '카테고리 타입',
  })
  type: CategoryType;

  @ApiProperty({ example: 'Utensils', description: 'lucide-react 아이콘 이름' })
  @IsOptional()
  @IsString()
  icon: string;
}
