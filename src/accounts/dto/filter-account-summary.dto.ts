import { IsDateString, IsEnum } from 'class-validator';

export class FilterAccountSummaryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly';
}
