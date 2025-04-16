import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CategoryType } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { BudgetStatsItemDTO } from "./budget-stats-item.dto";

export class BudgetStatsGroupDTO {
    @ApiProperty()
    @IsInt()
    totalBudget: number;
    @ApiProperty()
    @IsInt()
    totalSpent: number;
    @ApiProperty()
    @IsInt()
    totalIncome: number;
    @ApiProperty()
    @IsInt()
    totalRemaining: number;
    @ApiProperty()
    @IsString()
    startDate: string;
    @ApiProperty()
    @IsString()
    endDate: string;
    @ApiProperty({ type: [BudgetStatsItemDTO] })
    @IsArray()
    data: BudgetStatsItemDTO[];
}
