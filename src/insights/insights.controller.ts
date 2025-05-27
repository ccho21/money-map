import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InsightService } from './insights.service';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { UserPayload } from '@/auth/types/user-payload.type';
import { PatternInsightResponseDTO } from './dto/pattern.dto';
import { InsightQueryDTO } from './dto/query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { BudgetInsightResponseDTO } from './dto/budget.dto';

@ApiTags('insights')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard) // ✅ 여기에 추가
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightService) {}

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
    @Query() query: InsightQueryDTO, // 기간, 사용자 등
  ): Promise<BudgetInsightResponseDTO> {
    return this.insightsService.getBudgetInsights(user.id, query);
  }
}
