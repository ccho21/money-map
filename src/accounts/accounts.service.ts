import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getUserTimezone } from '@/libs/timezone';
import { getValidDay } from '@/libs/date.util';
import { toZonedTime } from 'date-fns-tz';
import { recalculateAccountBalanceInTx } from '@/transactions/utils/recalculateAccountBalanceInTx.util';

import {
  AccountCreateRequestDTO,
  AccountUpdateRequestDTO,
} from './dto/account-request.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: AccountCreateRequestDTO) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = toZonedTime(new Date(), timezone);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let settlementDate: number | null = null;
    let paymentDate: number | null = null;
    let autoPayment = false;

    if (dto.type === 'CARD') {
      settlementDate = dto.settlementDate
        ? getValidDay(year, month, dto.settlementDate)
        : null;

      paymentDate = dto.paymentDate
        ? getValidDay(year, month, dto.paymentDate)
        : null;

      autoPayment = dto.autoPayment ?? false;
    }

    return await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          userId,
          name: dto.name,
          balance: 0, // ✅ 초기에는 0으로 설정 (잔액은 트랜잭션으로 반영됨)
          description: dto.description ?? null,
          type: dto.type,
          color: dto.color ?? '#2196F3',
          settlementDate,
          paymentDate,
          autoPayment,
        },
      });

      // ✅ 초기 금액이 있다면 Opening Deposit 생성 (type = 'income')
      if (dto.balance && Number(dto.balance) > 0) {
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: 'income',
            amount: Number(dto.balance),
            date: now, // 타임존 기반 UTC
            note: 'Opening Balance',
            description: 'Account created with initial balance',
            isOpening: true,
          },
        });
      }

      // ✅ 계좌 잔액 재계산
      await recalculateAccountBalanceInTx(tx, account.id, userId);

      return account;
    });
  }

  async update(
    userId: string,
    accountId: string,
    dto: AccountUpdateRequestDTO,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const timezone = getUserTimezone(user);
    const now = toZonedTime(new Date(), timezone);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let settlementDate: number | null = null;
    let paymentDate: number | null = null;
    let autoPayment = false;

    if (dto.type === 'CARD') {
      settlementDate = dto.settlementDate
        ? getValidDay(year, month, dto.settlementDate)
        : null;

      paymentDate = dto.paymentDate
        ? getValidDay(year, month, dto.paymentDate)
        : null;

      autoPayment = dto.autoPayment ?? false;
    }

    // ✅ 계좌 메타 정보 업데이트 (balance 제외)
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        color: dto.color ?? '#2196F3',
        settlementDate,
        paymentDate,
        autoPayment,
      },
    });

    // ✅ Opening 트랜잭션이 있다면 금액만 업데이트
    if (dto.balance !== undefined) {
      const openingTx = await this.prisma.transaction.findFirst({
        where: {
          accountId,
          isOpening: true,
        },
      });

      if (openingTx) {
        await this.prisma.transaction.update({
          where: { id: openingTx.id },
          data: {
            amount: Number(dto.balance),
          },
        });
      } else if (Number(dto.balance) > 0) {
        // ✅ 없는데 초기 금액이 있다면 새로 생성
        await this.prisma.transaction.create({
          data: {
            userId,
            accountId,
            type: 'income',
            amount: Number(dto.balance),
            date: now,
            note: 'Opening Balance',
            description: 'Account updated with initial balance',
            isOpening: true,
          },
        });
      }
    }

    // ✅ 항상 잔액 재계산
    await recalculateAccountBalanceInTx(this.prisma, accountId, userId);

    return updated;
  }

  async findAll(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: { type: 'desc' },
    });
  }

  async findOne(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId)
      throw new ForbiddenException('Access denied');
    return account;
  }

  async remove(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // 👉 연결된 트랜잭션 등도 함께 제거 (예시: cascade delete)
    await this.prisma.$transaction([
      //TODO: 나중에 다시오자
      this.prisma.transaction.deleteMany({
        where: { accountId },
      }),
      this.prisma.account.delete({
        where: { id: accountId },
      }),
    ]);
  }
}
