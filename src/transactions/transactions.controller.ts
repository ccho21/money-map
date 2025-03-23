import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Transactions')
@UseGuards(JwtGuard)
@ApiBearerAuth('access_token') // 👈 main.ts에서 정한 이름과 동일해야 작동함!
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@GetUser() user, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user) {
    console.log('### user', user);
    return this.transactionsService.findAllByUser(user.sub);
  }
}
