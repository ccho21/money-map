import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CategoryDTO {
  @ApiProperty({ example: 'abc123', description: '카테고리 ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

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
  icon?: string;

  @ApiProperty({ example: '#ffffff', description: 'color code' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CategoryBudgetDTO {
  @ApiProperty({ example: 'cat123', description: '카테고리 ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

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
  icon?: string;

  @ApiProperty({ example: '#FF0000', description: '카테고리 색상 코드' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 300000, description: '해당 카테고리의 예산 금액' })
  budgetAmount: number;
}
