import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { UserPayload } from '@/auth/types/user-payload.type';
import { PatternInsightResponseDTO } from './dto/pattern.dto';
import { InsightQueryDTO } from './dto/query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { BudgetInsightResponseDTO } from './dto/budget.dto';
import { AlertInsightResponseDTO } from './dto/alert.dto';
import { RecurringInsightResponseDTO } from './dto/recurring.dto';

@ApiTags('insights')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard) // ✅ 여기에 추가
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('pattern')
  getPatternInsights(
    @GetUser() user: UserPayload,
    @Query() query: InsightQueryDTO,
  ): Promise<PatternInsightResponseDTO> {
    return this.insightsService.getPatternInsights(user.id, query);
  }

  @Get('budget')
  getBudgetInsights(
    @GetUser() user: UserPayload,
    @Query() query: InsightQueryDTO,
  ): Promise<BudgetInsightResponseDTO> {
    return this.insightsService.getBudgetInsights(user.id, query);
  }

  @Get('recurring')
  getRecurringInsights(
    @GetUser() user: UserPayload,
    @Query() query: InsightQueryDTO,
  ): Promise<RecurringInsightResponseDTO> {
    return this.insightsService.getRecurringInsights(user.id, query);
  }

  @Get('alerts')
  getAlertInsights(
    @GetUser() user: UserPayload,
    @Query() query: InsightQueryDTO,
  ): Promise<AlertInsightResponseDTO> {
    return this.insightsService.getAlertInsights(user.id, query);
  }
}
