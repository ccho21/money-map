import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChartDataItem {
  @ApiProperty({
    example: {
      Mon: 1200,
      Tue: 950,
      Wed: 120,
      Thu: 0,
      Fri: 800,
      Sat: 400,
      Sun: 1026,
    },
  })
  data: Record<string, number>;

  @ApiProperty({
    example: { key: 'Sun', value: 1026 },
    description: 'Highlighting peak value',
  })
  highlight?: {
    key: string;
    value: number;
  };

  @ApiPropertyOptional({
    example: { total: 5000, average: 714 },
  })
  meta?: Record<string, number | string>;
}
