import { CategoryDTO } from "@/categories/dto/category.dto";
import { GroupBy } from "@/common/types/types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class TransactionCalendarDTO {
    @ApiProperty()
    @IsString()
    date: string;
    @ApiProperty()
    @IsNumber()
    income: number;
    @ApiProperty()
    @IsNumber()
    expense: number;
}
