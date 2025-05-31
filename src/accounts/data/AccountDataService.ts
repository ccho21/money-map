// 📁 src/modules/budget/data/BudgetDataService.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AccountDataService {
  constructor(private readonly prisma: PrismaService) {}
}
