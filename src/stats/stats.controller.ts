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
import { TransactionGroupSummaryDTO } from '@/transactions/dto/transaction-group-summary.dto';
import { BaseStatsResponseDTO } from './dto/base/base-stats-response.dto';
import { CategoryStatsItemDTO } from './dto/category/group-item.dto';
import { NoteStatsItemDTO } from './dto/note/group-item.dto';
import { BudgetStatsItemDTO } from './dto/budget/group-item.dto';
import { CategoryGroupSummaryItemDTO } from './dto/category/summary.dto';
import { BudgetGroupSummaryItemDTO } from './dto/budget/summary.dto';
import { TransactionGroupItemDTO } from '@/transactions/dto/transaction-group-item.dto';
import { NoteGroupSummaryItemDTO } from './dto/note/summary.dto';

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
  ): Promise<BaseStatsResponseDTO<CategoryStatsItemDTO>> {
    return this.statsService.getByCategory(user.id, query);
  }

  @Get('by-budget')
  getByBudget(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<BudgetStatsItemDTO>> {
    return this.statsService.getByBudget(user.id, query);
  }

  @Get('by-note')
  @UseGuards(JwtAuthGuard)
  async getByNote(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<NoteStatsItemDTO>> {
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
  ): Promise<TransactionGroupSummaryDTO> {
    return this.statsService.getStatsCategory(user.id, categoryId, query);
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
  ): Promise<BaseStatsResponseDTO<CategoryGroupSummaryItemDTO>> {
    return this.statsService.getStatsCategorySummary(
      user.id,
      categoryId,
      query,
    );
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
  getStatsBudgetCategory(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<TransactionGroupSummaryDTO> {
    return this.statsService.getStatsBudgetCategory(user.id, categoryId, query);
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
  ): Promise<BaseStatsResponseDTO<BudgetGroupSummaryItemDTO>> {
    return this.statsService.getStatsBudgetSummary(user.id, categoryId, query);
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
  getStatsNoteDetail(
    @GetUser() user: UserPayload,
    @Param('note') note: string,
    @Query() query: StatsQuery,
  ): Promise<BaseStatsResponseDTO<TransactionGroupItemDTO>> {
    return this.statsService.getStatsNoteDetail(user.id, note, query);
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
  ): Promise<BaseStatsResponseDTO<NoteGroupSummaryItemDTO>> {
    return this.statsService.getStatsNoteSummary(user.id, note, query);
  }
}
