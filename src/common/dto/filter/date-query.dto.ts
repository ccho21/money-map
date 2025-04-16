import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DateQueryDTO {
  @ApiProperty({ example: '2025-04-01', required: false })
  @IsOptional()
  @IsISO8601()
  startDate: string;

  @ApiProperty({ example: '2025-04-30', required: false })
  @IsOptional()
  @IsISO8601()
  endDate: string;
}
