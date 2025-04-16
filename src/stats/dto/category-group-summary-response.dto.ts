import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { CategoryGroupSummaryDTO } from './category-group-summary.dto';
import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';

export class CategoryGroupSummaryResponseDTO extends BaseListSummaryResponseDTO<CategoryGroupSummaryDTO> {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty()
  @IsString()
  categoryName: string;
}
