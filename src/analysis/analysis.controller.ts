import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';

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

  @Get('by-category')
  @ApiQuery({ name: 'categoryId', required: true })
  getByCategory(
    @GetUser() user: UserPayload,
    @Query('categoryId') categoryId: string,
  ) {
    return this.analysisService.getByCategory(user.id, categoryId);
  }

  @Get('ranking')
  getTopSpendingPeriods(@GetUser() user: UserPayload) {
    return this.analysisService.getTopSpendingPeriods(user.id);
  }

  @Get('yoy')
  getYoY(@GetUser() user: UserPayload) {
    return this.analysisService.getYoYComparison(user.id);
  }

  @Get('mom')
  getMoM(@GetUser() user: UserPayload) {
    return this.analysisService.getMoMComparison(user.id);
  }
}
