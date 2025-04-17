import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { UserPayload } from 'src/auth/types/user-payload.type';
import { StatsQuery } from './dto/stats-query.dto';
import { GroupBy } from '@/common/types/types';

import { BaseListSummaryResponseDTO } from '@/common/dto/base-list-summary-response.dto';
import { StatsCategoryGroupItemDTO } from './dto/category/group-item.dto';
import { StatsBudgetGroupItemDTO } from './dto/budget/group-item.dto';
import { StatsNoteGroupItemDTO } from './dto/note/group-item.dto';
import { StatsCategoryDetailDTO } from './dto/category/detail.dto';
import { StatsBudgetDetailDTO } from './dto/budget/detail.dto';
import { StatsNoteDetailDTO } from './dto/note/detail.dto';
import { StatsCategorySummaryDTO } from './dto/category/summary.dto';
import { StatsBudgetSummaryDTO } from './dto/budget/summary.dto';
import { StatsNoteSummaryDTO } from './dto/note/summary.dto';

@ApiTags('Stats')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}
  @Get('by-category')
  async getByCategory(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsCategoryGroupItemDTO>> {
    return this.statsService.getByCategory(user.id, query);
  }

  @Get('by-budget')
  getByBudget(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsBudgetGroupItemDTO>> {
    return this.statsService.getByBudget(user.id, query);
  }

  @Get('by-note')
  @UseGuards(JwtAuthGuard)
  async getByNote(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<BaseListSummaryResponseDTO<StatsNoteGroupItemDTO>> {
    return this.statsService.getByNote(user.id, query);
  }

  @Get('/category/:categoryId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '카테고리 기준 통계 조회' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsCategory(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<StatsCategoryDetailDTO> {
    return this.statsService.getStatsCategory(user.id, categoryId, query);
  }

  @Get('/budget/:categoryId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '카테고리 기준 통계 조회' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsBudget(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<StatsBudgetDetailDTO> {
    return this.statsService.getStatsBudget(user.id, categoryId, query);
  }

  @Get('/note/:note')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '노트 기준 상세 통계 (구간별 트랜잭션 요약)' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsNote(
    @GetUser() user: UserPayload,
    @Param('note') note: string,
    @Query() query: StatsQuery,
  ): Promise<StatsNoteDetailDTO> {
    return this.statsService.getStatsNote(user.id, note, query);
  }

  @Get('/category/:categoryId/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '카테고리 기준 통계 조회' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsCategorySummary(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<StatsCategorySummaryDTO> {
    return this.statsService.getStatsCategorySummary(
      user.id,
      categoryId,
      query,
    );
  }

  @Get('/budget/:categoryId/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '카테고리 기준 통계 조회' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsBudgetSummary(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<StatsBudgetSummaryDTO> {
    return this.statsService.getStatsBudgetSummary(user.id, categoryId, query);
  }

  @Get('/note/:note/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '노트 기반 통계 상세 조회 (1년치 + 트랜잭션 포함)' })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  @ApiQuery({ name: 'type', enum: ['income', 'expense'], required: true })
  @ApiQuery({
    name: 'groupBy',
    enum: GroupBy,
    required: true,
  })
  getStatsNoteSummary(
    @GetUser() user: UserPayload,
    @Param('note') note: string,
    @Query() query: StatsQuery,
  ): Promise<StatsNoteSummaryDTO> {
    return this.statsService.getStatsNoteSummary(user.id, note, query);
  }
}
