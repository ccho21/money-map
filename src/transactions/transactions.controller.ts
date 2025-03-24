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
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@ApiTags('Transactions')
@UseGuards(JwtGuard)
@ApiBearerAuth('access-token')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@GetUser() user, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'] })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @GetUser() user,
    @Query('type') type?: 'income' | 'expense',
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.transactionsService.findFiltered(user.sub, {
      type,
      categoryId,
      startDate,
      endDate,
      search,
    });
  }

  @Patch(':id')
  update(
    @GetUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@GetUser() user, @Param('id') id: string) {
    return this.transactionsService.remove(user.sub, id);
  }
}
