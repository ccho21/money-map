import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BudgetAlertDTO {
  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  message: string;
}
