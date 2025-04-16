import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CategoryType } from "@prisma/client";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { CategoryStatsItemDTO } from "./category-stats-item.dto";

export class CategoryStatsGroupDTO {
    @ApiProperty({ type: [CategoryStatsItemDTO] })
    data: CategoryStatsItemDTO[];
    @ApiProperty()
    @IsInt()
    totalIncome: number;
    @ApiProperty()
    @IsInt()
    totalExpense: number;
}
