import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class BaseStatsItemDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsInt()
  amount: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  budgetId?: string;
}
