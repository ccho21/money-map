import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Utensils', description: 'lucide-react 아이콘 이름' })
  @IsString()
  icon: string;

  @ApiProperty({
    example: 'expense',
    enum: ['income', 'expense'],
    description: '카테고리 타입',
  })
  @IsString()
  @IsIn(['income', 'expense']) // ✅ 유효성 체크 추가
  type: 'income' | 'expense';
}

export class CategoryDto {
  @ApiProperty({ example: 'abc123', description: '카테고리 ID' })
  id: string;

  @ApiProperty({ example: '식비', description: '카테고리 이름' })
  name: string;

  @ApiProperty({ example: 'Utensils', description: 'lucide-react 아이콘 이름' })
  icon: string;

  @ApiProperty({
    example: 'expense',
    enum: ['income', 'expense'],
    description: '카테고리 타입',
  })
  type: 'income' | 'expense';
}
