import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { TransactionSummaryDTO } from './dto/transaction.dto';
import {
  DateQueryDto,
  FindTransactionQueryDto,
  SummaryRangeQueryDto,
} from './dto/filter-transaction.dto';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionsService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CreateTransactionDto) {
    return this.transactionService.create(user.id, dto);
  }

  @Get()
  @ApiQuery({ type: FindTransactionQueryDto })
  findAll(
    @GetUser() user: UserPayload,
    @Query() query: FindTransactionQueryDto,
  ) {
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
    @Query() query: SummaryRangeQueryDto,
  ): Promise<TransactionSummaryDTO> {
    return this.transactionService.getTransactionSummary(user.id, query);
  }

  @Get('calendar')
  getCalendarView(
    @GetUser('id') user: UserPayload,
    @Query() query: DateQueryDto,
  ) {
    return this.transactionService.getTransactionCalendarView(user.id, query);
  }

  // @Patch(':id')
  // update(
  //   @GetUser() user: UserPayload,
  //   @Param('id') id: string,
  //   @Body() dto: UpdateTransactionDto,
  // ) {
  //   return this.transactionService.update(user.id, id, dto);
  // }

  // @Delete(':id')
  // remove(@GetUser() user: UserPayload, @Param('id') id: string) {
  //   return this.transactionService.remove(user.id, id);
  // }
}
