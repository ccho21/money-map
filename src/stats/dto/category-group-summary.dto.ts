import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsString } from "class-validator";

export class CategoryGroupSummaryDTO {
    @ApiProperty()
    @IsString()
    label: string;
    @ApiProperty()
    @IsString()
    startDate: string;
    @ApiProperty()
    @IsString()
    endDate: string;
    @ApiProperty()
    @IsBoolean()
    isCurrent: boolean;
    @ApiProperty()
    @IsNumber()
    income: number;
    @ApiProperty()
    @IsNumber()
    expense: number;
    @ApiProperty()
    @IsNumber()
    total: number;
}
