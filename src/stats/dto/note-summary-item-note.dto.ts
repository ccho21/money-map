import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsString } from "class-validator";

export class NoteSummaryItemNoteDTO {
    @ApiProperty({ example: '2025-04', description: '구간 라벨' })
    @IsString()
    label: string;
    @ApiProperty({ example: '2025-04-01', description: '구간 시작일' })
    @IsString()
    startDate: string;
    @ApiProperty({ example: '2025-04-30', description: '구간 종료일' })
    @IsString()
    endDate: string;
    @ApiProperty({ example: 0, description: '해당 구간의 수입' })
    @IsNumber()
    income: number;
    @ApiProperty({ example: 30000, description: '해당 구간의 지출' })
    @IsNumber()
    expense: number;
    @ApiProperty({ example: true, description: '현재 구간 여부' })
    @IsBoolean()
    isCurrent: boolean;
}
