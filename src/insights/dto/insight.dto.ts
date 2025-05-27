import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';

export class InsightDTO {
  @ApiProperty({ example: 'budgetExceeded.food' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Dining budget exceeded' })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'You’ve spent 24% more than your dining budget this month.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    enum: ['pattern', 'budget', 'recurring', 'alert'],
    example: 'budget',
  })
  @IsEnum(['pattern', 'budget', 'recurring', 'alert'])
  type: 'pattern' | 'budget' | 'recurring' | 'alert';

  @ApiProperty({ enum: ['info', 'warning', 'critical'], example: 'warning' })
  @IsEnum(['info', 'warning', 'critical'])
  severity: 'info' | 'warning' | 'critical';

  @ApiPropertyOptional({ example: 'utensils' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: '2025-05-21T10:00:00.000Z' })
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional({
    example: {
      type: 'category',
      id: 'cat_123',
    },
  })
  @IsOptional()
  @IsObject()
  entityRef?: {
    type: 'budget' | 'category' | 'transaction';
    id: string;
  };

  @ApiPropertyOptional({
    example: {
      spent: 149000,
      budgeted: 120000,
      percentOver: 24,
    },
    type: Object,
  })
  @IsOptional()
  context?: Record<string, any>;

  @ApiPropertyOptional({ example: 'Adjust Budget' })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiPropertyOptional({ example: '/budget/settings' })
  @IsOptional()
  @IsString()
  actionUrl?: string;
}
