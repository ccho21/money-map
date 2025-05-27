import { Module } from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { RecurringController } from './recurring.controller';
import { RecurringScheduler } from './recurring.scheduler';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringScheduler],
})
export class RecurringModule {}
