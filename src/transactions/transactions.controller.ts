import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { TransactionCreateDTO } from './dto/transaction-create.dto';
import {
  DateQueryDTO,
  SummaryRangeQueryDTO,
  TransactionFilterDTO,
} from './dto/transaction-filter.dto';
import { TransactionSummaryDTO } from './dto/transaction.dto';
import { TransactionUpdateDTO } from './dto/transaction-update.dto';
import { TransactionTransferDTO } from './dto/transaction-transfer.dto';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: TransactionCreateDTO) {
    return this.transactionService.create(user.id, dto);
  }

  @Get()
  @ApiQuery({ type: TransactionFilterDTO })
  findAll(@GetUser() user: UserPayload, @Query() query: TransactionFilterDTO) {
    return this.transactionService.findFiltered(user.id, query);
  }

  @Get('summary')
  @ApiQuery({
    name: 'groupBy',
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true,
  })
  @ApiQuery({ name: 'startDate', type: String, required: true })
  @ApiQuery({ name: 'endDate', type: String, required: true })
  getTransactionSummary(
    @GetUser() user: UserPayload,
    @Query() query: SummaryRangeQueryDTO,
  ): Promise<TransactionSummaryDTO> {
    return this.transactionService.getTransactionSummary(user.id, query);
  }

  @Post('/transfer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '계좌 간 이체 생성' })
  createTransfer(
    @Body() createTransferDto: TransactionTransferDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.createTransfer(user.id, createTransferDto);
  }

  @Get('calendar')
  getCalendarView(@GetUser() user: UserPayload, @Query() query: DateQueryDTO) {
    return this.transactionService.getTransactionCalendarView(user.id, query);
  }

  @Put('/transfer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이체 트랜잭션 수정' })
  updateTransfer(
    @Param('id') id: string,
    @Body() dto: TransactionTransferDTO,
    @GetUser() user: UserPayload,
  ) {
    return this.transactionService.updateTransfer(user.id, id, dto);
  }

  @Delete('/transfer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이체 트랜잭션 삭제' })
  deleteTransfer(@Param('id') id: string, @GetUser() user: UserPayload) {
    return this.transactionService.deleteTransfer(user.id, id);
  }

  @Get(':id')
  findOne(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.getTransactionById(user.id, id);
  }

  @Put(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: TransactionUpdateDTO,
  ) {
    return this.transactionService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.transactionService.delete(user.id, id);
  }
}
