import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString } from 'class-validator';

export class BudgetDetailDTO {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  total: number;

  @ApiProperty({ type: [String] })
  categoryIds: string[];

  @ApiProperty()
  @IsDateString()
  createdAt: string;

  @ApiProperty()
  @IsDateString()
  updatedAt: string;
}
