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
import { StatsByCategoryDTO } from './dto/stats-by-category.dto';
import { StatsQuery } from './dto/stats-query.dto';
import { StatsByNoteDTO } from './dto/stats-by-note.dto';
import { TransactionSummaryDTO } from '@/transactions/dto/transaction.dto';
import { GroupBy } from '@/common/types/types';

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
  ): Promise<StatsByCategoryDTO> {
    return this.statsService.getByCategory(user.id, query);
  }

  @Get('by-budget')
  getByBudget(@GetUser() user: UserPayload, @Query() query: StatsQuery) {
    return this.statsService.getByBudget(user.id, query);
  }

  @Get('by-note')
  @UseGuards(JwtAuthGuard)
  async getByNote(
    @GetUser() user: UserPayload,
    @Query() query: StatsQuery,
  ): Promise<StatsByNoteDTO> {
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
  ): Promise<TransactionSummaryDTO> {
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
  getStatsBudgetCategory(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Query() query: StatsQuery,
  ): Promise<TransactionSummaryDTO> {
    return this.statsService.getStatsBudgetCategory(user.id, categoryId, query);
  }
}
