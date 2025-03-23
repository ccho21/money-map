import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const transaction = await this.prisma.transaction.create({
      data: {
        ...dto,
        userId,
        date: new Date(dto.date),
      },
    });

    // ✅ 카테고리 정보 조회
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new Error('카테고리를 찾을 수 없습니다.');
    }

    // ✅ 예산 항목 조회
    const budgetItem = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId: dto.categoryId,
        budget: { userId },
      },
    });

    if (budgetItem) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          categoryId: dto.categoryId,
          userId,
        },
        _sum: { amount: true },
      });

      const totalSpent: number = spent._sum.amount || 0;

      if (totalSpent > budgetItem.amount) {
        console.log('### 예산 초과!');
        // ✅ 소켓 알림 전송
        this.eventsGateway.emitBudgetAlert(userId, {
          category: category.name,
          message: `예산 초과! ₩${totalSpent - budgetItem.amount}`,
        });
      }
    }

    return transaction;
  }

  async findAllByUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }
}
