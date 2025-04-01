import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { StatsByCategoryDTO } from './dto/stats-by-category.dto';
import { StatsQuery } from './dto/stats-query.dto';
import { StatsByNoteDTO } from './dto/stats-by-note.dto';

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
}
