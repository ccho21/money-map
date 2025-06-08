// transactions.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { TransactionsService } from './transactions.service';
import { TransactionsAnalysisService } from './analysis.service';

import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';
import { TransactionChartFlowDTO } from './dto/charts/transaction-chart-flow.dto';
import { TransactionChartCategoryDTO } from './dto/charts/transaction-chart-category.dto';
import { TransactionChartBudgetDTO } from './dto/charts/transaction-chart-budget.dto';
import { TransactionChartAccountDTO } from './dto/charts/transaction-chart-account.dto';
import { TransactionDetailDTO } from './dto/transactions/transaction-detail.dto';
import { CreateTransactionDTO } from './dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from './dto/transactions/transaction-update.dto';
import { TransactionsTransferService } from './transfer.service';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionService: TransactionsService,
    private readonly transferService: TransactionsTransferService,
    private readonly analysisService: TransactionsAnalysisService,
  ) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CreateTransactionDTO) {
    return this.transactionService.create(user.id, dto);
  }

  @Get('summary')
  getSummary(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.analysisService.getTransactionSummary(user.id, query);
  }

  @Get('groups')
  getGroupedTransactions(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.analysisService.getGroupedTransactions(user.id, query);
  }

  @Get('calendar')
  getCalendarView(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ) {
    return this.analysisService.getTransactionCalendarView(user.id, query);
  }

  @Get('keyword/recommendations')
  getKeywords(@GetUser() user: UserPayload) {
    return this.analysisService.getRecommendedKeywords(user.id);
  }

  @Get('charts/flow')
  getChartFlow(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartFlowDTO> {
    return this.analysisService.getChartFlow(user.id, query);
  }

  @Get('charts/category')
  getChartCategory(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartCategoryDTO> {
    return this.analysisService.getChartCategory(user.id, query);
  }

  @Get('charts/account')
  getChartAccount(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartAccountDTO> {
    return this.analysisService.getChartAccount(user.id, query);
  }

  @Get('charts/budget')
  getChartBudget(
    @GetUser() user: UserPayload,
    @Query() query: TransactionGroupQueryDTO,
  ): Promise<TransactionChartBudgetDTO> {
    return this.analysisService.getChartBudget(user.id, query);
  }

  @Post('transfer')
  @ApiOperation({ summary: '계좌 간 이체 생성' })
  createTransfer(
    @Body() dto: CreateTransactionDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transferService.createTransfer(user.id, dto);
  }

  @Patch('transfer/:id')
  @ApiOperation({ summary: '이체 트랜잭션 수정' })
  updateTransfer(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transferService.updateTransfer(user.id, id, dto);
  }

  @Delete('transfer/:id')
  @ApiOperation({ summary: '이체 트랜잭션 삭제' })
  deleteTransfer(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.transferService.deleteTransfer(user.id, id);
  }

  @Get(':id')
  findOne(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
  ): Promise<TransactionDetailDTO> {
    return this.transactionService.getTransactionById(user.id, id);
  }

  @Patch(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDTO,
  ) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.delete(user.id, id);
  }
}
