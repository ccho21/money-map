import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class BudgetGroupSummaryDTO {
  @ApiProperty({ example: '2024-04', description: '그룹 레이블 (월/주 등)' })
  @IsString()
  label: string;

  @ApiProperty({ example: '2024-04-01', description: '그룹 시작일' })
  @IsString()
  rangeStart: string;

  @ApiProperty({ example: '2024-04-30', description: '그룹 종료일' })
  @IsString()
  rangeEnd: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalBudget: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalSpent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  rate: number;
}
