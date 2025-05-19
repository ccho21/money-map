import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { UserPayload } from '@/auth/types/user-payload.type';
import { DashboardDTO } from './dto/dashboard.dto';
import { TransactionGroupQueryDTO } from '@/transactions/dto/params/transaction-group-query.dto';

import { JwtAuthGuard } from '@/common/guards/jwt.guard';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard) // ✅ 여기에 추가
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<DashboardDTO> {
    return this.dashboardService.getDashboard(user.id, query);
  }
}
