import { IsISO8601 } from 'class-validator';

export class BaseDateQueryDTO {
  @IsISO8601()
  date: string;
}
