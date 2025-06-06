import {
  Controller,
  Post,
  Body,
  UseGuards,
  Delete,
  Param,
} from '@nestjs/common';

import { RecurringService } from './recurring.service';
import { UserPayload } from '@/auth/types/user-payload.type';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { JwtAuthGuard } from '@/common/guards/jwt.guard';

@Controller('recurring')
@UseGuards(JwtAuthGuard)
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post()
  async createRecurring(
    @GetUser() user: UserPayload,
    @Body() dto: CreateRecurringTransactionDto,
  ) {
    return this.recurringService.create(user.id, dto);
  }

  @Delete(':id')
  async softDeleteRecurring(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
  ) {
    return this.recurringService.softDelete(user.id, id);
  }
}
