import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { GetByCategoryDto } from './dto/get-by-category.dto';
import { GetBudgetSummaryDto } from './dto/get-budget-summary.dto';
import { GetNoteSummaryDto } from './dto/get-note-summary.dto';

@ApiTags('Analysis')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('summary')
  @ApiQuery({ name: 'range', enum: ['weekly', 'monthly', 'yearly'] })
  getSummary(
    @GetUser() user: UserPayload,
    @Query('range') range: 'weekly' | 'monthly' | 'yearly' = 'monthly',
  ) {
    return this.analysisService.getSummary(user.id, range);
  }

  @Get('transactions/by-category')
  getCategorySummary(@Query() dto: GetByCategoryDto) {
    return this.analysisService.getCategorySummary(dto);
  }

  @Get('budgets')
  getBudgetSummary(@Query() dto: GetBudgetSummaryDto) {
    return this.analysisService.getBudgetSummary(dto);
  }

  @Get('notes')
  getNoteSummary(@Query() dto: GetNoteSummaryDto) {
    return this.analysisService.getNoteSummary(dto);
  }
}
