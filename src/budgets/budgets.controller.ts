import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@GetUser() user, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user) {
    return this.budgetsService.findAllByUser(user.sub);
  }

  @Get('alerts')
  alerts(@GetUser() user) {
    return this.budgetsService.getBudgetAlerts(user.sub);
  }
}
