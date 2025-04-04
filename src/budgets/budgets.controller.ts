import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Put,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { BudgetQueryDto } from './dto/budget-query.dto';
import {
  BudgetCategoryListDTO,
  CreateBudgetCategoryDTO,
  UpdateBudgetCategoryDTO,
} from './dto/budget-category.dto';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.budgetsService.findAll(user.id);
  }

  // @Get('alerts')
  // alerts(@GetUser() user: UserPayload): Promise<BudgetAlert[]> {
  //   return this.budgetsService.getBudgetAlerts(user.id);
  // }

  @Get('summary')
  getBudgetSummary(
    @GetUser() user: UserPayload,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetsService.getBudgetSummary(user.id, query);
  }

  @Get('by-category')
  @UseGuards(JwtAuthGuard)
  getByCategory(@GetUser() user: UserPayload, @Query() query: BudgetQueryDto) {
    return this.budgetsService.getBudgetCategories(user.id, query);
  }

  @Post('by-category')
  @UseGuards(JwtAuthGuard)
  createBudgetCategory(
    @GetUser() user: UserPayload,
    @Body() dto: CreateBudgetCategoryDTO,
  ) {
    return this.budgetsService.createBudgetCategory(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/by-category/:categoryId')
  async getBudgetCategoryByCategoryId(
    @GetUser() user: UserPayload,
    @Param('categoryId') categoryId: string,
    @Body() body: BudgetQueryDto,
  ) {
    return this.budgetsService.getGroupedBudgetCategories(
      user.id,
      categoryId,
      body,
    );
  }
  
  @Put('by-category/:id')
  @UseGuards(JwtAuthGuard)
  updateBudgetCategory(
    @GetUser() user: UserPayload,
    @Param('id') budgetId: string,
    @Body() dto: UpdateBudgetCategoryDTO,
  ) {
    return this.budgetsService.updateBudgetCategory(user.id, budgetId, dto);
  }
}
