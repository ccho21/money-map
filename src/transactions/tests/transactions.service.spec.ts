import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../transactions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory } from '@/mocks/mockHelpers';
import { CreateTransactionDTO } from '../dto/transactions/transaction-create.dto';
import { UpdateTransactionDTO } from '../dto/transactions/transaction-update.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BudgetAlertService } from '../budget-alert.service';
import { randomUUID } from 'crypto';
import * as balanceUtils from '@/transactions/utils/recalculateAccountBalanceInTx.util';

jest.mock('@/transactions/utils/recalculateAccountBalanceInTx.util', () => ({
  recalculateAccountBalanceInTx: jest.fn(),
}));

/**
 * Fresh tests for TransactionsService.
 * Focus on deterministic behaviour for individual methods.
 */

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        { provide: BudgetAlertService, useValue: { checkAndEmit: jest.fn() } }, // ✅ 추가
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  ///////// Create /////////
  describe('TransactionsService - create()', () => {
    let service: TransactionsService;
    let prisma: jest.Mocked<PrismaService>;
    let budgetAlertService: BudgetAlertService;
    let userId: string;
    let accountId: string;
    let categoryId: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          TransactionsService,
          PrismaService,
          {
            provide: BudgetAlertService,
            useValue: { checkAndEmit: jest.fn() },
          }, // ✅ 추가
        ],
      }).compile();

      service = moduleRef.get(TransactionsService);
      budgetAlertService = moduleRef.get(BudgetAlertService);
      prisma = moduleRef.get(PrismaService);

      // Test data
      const user = await prisma.user.create({
        data: {
          email: `test-${randomUUID()}@test.com`,
          password: 'hashed-password', // ✅ 필수 필드 추가
        },
      });
      userId = user.id;

      const category = await prisma.category.create({
        data: {
          name: '식비',
          type: 'expense',
          userId,
          icon: '🍔',
          color: '#ff0000',
        },
      });
      categoryId = category.id;

      const account = await prisma.account.create({
        data: {
          name: '현금',
          type: 'CASH',
          userId,
          balance: 0,
          color: '#000000',
        },
      });
      accountId = account.id;
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany(); // ✅ 1. 트랜잭션부터
      await prisma.recurringTransaction.deleteMany(); // ✅ 2. 반복 트랜잭션
      await prisma.budgetCategory.deleteMany(); // ✅ 3. FK를 먼저 제거해야 함
      await prisma.budget.deleteMany(); // ✅ 4. 예산 본체
      await prisma.account.deleteMany(); // ✅ 5. 계좌
      await prisma.category.deleteMany(); // ✅ 6. 카테고리 (이제 가능)
      await prisma.user.deleteMany(); // ✅ 7. 유저
    });

    it('should create a transaction and return it', async () => {
      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 5000,
        accountId,
        categoryId,
        note: '점심',
        description: '김밥천국',
        date: new Date().toISOString(),
      };

      const tx = await service.create(userId, dto);

      expect(tx).toBeDefined();
      expect(tx.id).toBeDefined();
      expect(tx.amount).toBe(dto.amount);
      expect(tx.accountId).toBe(dto.accountId);
      expect(tx.categoryId).toBe(dto.categoryId);

      const found = await prisma.transaction.findUnique({
        where: { id: tx.id },
      });
      expect(found).not.toBeNull();
    });

    it('should throw if user is not found', async () => {
      const invalidUserId = 'non-existent-user';

      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 1000,
        accountId,
        categoryId,
        date: new Date().toISOString(),
      };

      await expect(service.create(invalidUserId, dto)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw NotFoundException if category is not found', async () => {
      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 1000,
        accountId,
        categoryId: 'invalid-category-id',
        date: new Date().toISOString(),
      };

      await expect(service.create(userId, dto)).rejects.toThrow(
        '카테고리를 찾을 수 없습니다.',
      );
    });

    it('should throw NotFoundException if account is not found', async () => {
      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 1000,
        accountId: 'invalid-account-id',
        categoryId,
        date: new Date().toISOString(),
      };

      await expect(service.create(userId, dto)).rejects.toThrow(
        '계좌를 찾을 수 없습니다.',
      );
    });

    it('should create a recurringTransaction when dto.recurring is provided', async () => {
      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 2000,
        accountId,
        categoryId,
        date: new Date().toISOString(),
        recurring: {
          frequency: 'monthly',
          interval: 1, // ✅ 추가
          startDate: new Date().toISOString(),
        },
      };

      const tx = await service.create(userId, dto);

      expect(tx.recurringTransactionId).toBeDefined();

      const recurring = await prisma.recurringTransaction.findUnique({
        where: { id: tx.recurringTransactionId! },
      });

      expect(recurring).not.toBeNull();
      expect(recurring!.frequency).toBe('monthly');
    });

    it('should emit budget alert if category budget is exceeded', async () => {
      const budget = await prisma.budget.create({
        data: {
          userId,
          total: 10000,
        },
      });

      await prisma.budgetCategory.create({
        data: {
          budgetId: budget.id,
          categoryId,
          amount: 1000,
          type: 'expense',
          startDate: new Date(new Date().getFullYear(), 0, 1),
          endDate: new Date(new Date().getFullYear(), 11, 31),
        },
      });

      // 💬 spy 설정
      const spyEmit = jest.spyOn(budgetAlertService, 'checkAndEmit');

      const dto: CreateTransactionDTO = {
        type: 'expense',
        amount: 2000,
        accountId,
        categoryId,
        date: new Date().toISOString(),
      };

      await service.create(userId, dto);

      expect(spyEmit).toHaveBeenCalled();
    });
  });

  ///////// Update /////////
  describe('TransactionsService - update()', () => {
    let service: TransactionsService;
    let prisma: PrismaService;
    let budgetAlertService: BudgetAlertService;
    let userId: string;
    let accountId: string;
    let categoryId: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          TransactionsService,
          PrismaService,
          {
            provide: BudgetAlertService,
            useValue: { checkAndEmit: jest.fn() },
          }, // ✅ 추가
        ],
      }).compile();

      service = moduleRef.get(TransactionsService);
      budgetAlertService = moduleRef.get(BudgetAlertService);
      prisma = moduleRef.get(PrismaService);

      // test data
      const user = await prisma.user.create({
        data: {
          email: `test-${randomUUID()}@test.com`,
          password: 'hashed-password', // ✅ 필수 필드 추가
        },
      });
      userId = user.id;

      const category = await prisma.category.create({
        data: {
          name: 'Food',
          type: 'expense',
          userId,
          icon: '🍜',
          color: '#ff0000',
        },
      });
      categoryId = category.id;

      const account = await prisma.account.create({
        data: {
          name: 'Cash',
          type: 'CASH',
          userId,
          balance: 0,
          color: '#00ff00',
        },
      });
      accountId = account.id;
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany(); // ✅ 1. 트랜잭션부터
      await prisma.recurringTransaction.deleteMany(); // ✅ 2. 반복 트랜잭션
      await prisma.budgetCategory.deleteMany(); // ✅ 3. FK를 먼저 제거해야 함
      await prisma.budget.deleteMany(); // ✅ 4. 예산 본체
      await prisma.account.deleteMany(); // ✅ 5. 계좌
      await prisma.category.deleteMany(); // ✅ 6. 카테고리 (이제 가능)
      await prisma.user.deleteMany(); // ✅ 7. 유저
    });

    //✅ 1. 트랜잭션 수정 성공 테스트 (amount & note 변경)
    it('should update an existing transaction and return it', async () => {
      // 1. 기존 트랜잭션 생성
      const original = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          type: 'expense',
          amount: 1000,
          date: new Date(),
        },
      });

      // 2. 업데이트 DTO 준비
      const dto: UpdateTransactionDTO = {
        amount: 3000,
        note: '수정된 점심 값',
      };

      // 3. 서비스 호출
      const updated = await service.update(userId, original.id, dto);

      // 4. 결과 검증
      expect(updated).toBeDefined();
      expect(updated.id).toBe(original.id);
      expect(updated.amount).toBe(dto.amount);
      expect(updated.note).toBe(dto.note);

      // 5. 실제 DB 반영 확인
      const found = await prisma.transaction.findUnique({
        where: { id: original.id },
      });
      expect(found!.amount).toBe(3000);
      expect(found!.note).toBe('수정된 점심 값');
    });

    // ✅ 2. 트랜잭션 ID가 잘못된 경우 → NotFoundException
    it('should throw NotFoundException if transaction does not exist', async () => {
      const dto: UpdateTransactionDTO = {
        amount: 9999,
      };

      await expect(
        service.update(userId, 'non-existent-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    //  ✅ 3. 다른 사용자의 트랜잭션일 경우 → NotFoundException
    it('should throw NotFoundException if transaction does not belong to user', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: `test-${randomUUID()}@test.com`,
          password: 'hashed',
        },
      });

      const txOfOtherUser = await prisma.transaction.create({
        data: {
          userId: otherUser.id,
          accountId,
          categoryId,
          type: 'expense',
          amount: 2000,
          date: new Date(),
        },
      });

      const dto: UpdateTransactionDTO = {
        amount: 3000,
      };

      await expect(
        service.update(userId, txOfOtherUser.id, dto),
      ).rejects.toThrow(NotFoundException);
    });

    // ✅ 4. isOpening일 경우 → BadRequestException
    it('should throw BadRequestException if transaction is an opening balance', async () => {
      const openingTx = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          type: 'income',
          amount: 10000,
          date: new Date(),
          isOpening: true,
        },
      });

      const dto: UpdateTransactionDTO = {
        amount: 5000,
      };

      await expect(service.update(userId, openingTx.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    // ✅ 5. 계좌 변경 시 잔액 재계산이 두 번 호출되는지 확인
    it('should call recalculateAccountBalanceInTx twice if accountId is changed', async () => {
      const newAccount = await prisma.account.create({
        data: {
          userId,
          name: 'New Account',
          type: 'BANK',
          balance: 0,
          color: '#0000ff',
        },
      });

      // 1. 기존 트랜잭션 생성 (기존 accountId 기준)
      const tx = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          type: 'expense',
          amount: 1000,
          date: new Date(),
        },
      });

      // 2. 업데이트 요청 (accountId 변경)
      const dto: UpdateTransactionDTO = {
        accountId: newAccount.id,
      };

      const spy = jest.spyOn(balanceUtils, 'recalculateAccountBalanceInTx');

      spy.mockClear(); //

      await service.update(userId, tx.id, dto);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(expect.anything(), accountId, userId); // 기존 계좌
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        newAccount.id,
        userId,
      ); // 새 계좌
    });

    // ✅ 6. 기존에 recurring 연결이 있었는데 dto.recurring이 없는 경우 → 삭제 처리
    it('should delete existing recurring if dto.recurring is undefined', async () => {
      const recurring = await prisma.recurringTransaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          amount: 1000,
          type: 'expense',
          frequency: 'monthly',
          interval: 1,
          startDate: new Date(),
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          type: 'expense',
          amount: 1000,
          date: new Date(),
          recurringTransactionId: recurring.id,
        },
      });

      const dto: UpdateTransactionDTO = {
        amount: 2000,
        // dto.recurring is undefined → should remove recurring link
      };

      const updated = await service.update(userId, tx.id, dto);

      const found = await prisma.transaction.findUnique({
        where: { id: tx.id },
      });
      expect(found!.recurringTransactionId).toBeNull();

      const recurringAfter = await prisma.recurringTransaction.findUnique({
        where: { id: recurring.id },
      });
      expect(recurringAfter).toBeNull();
    });

    it('should emit budget alert if transaction causes budget to exceed', async () => {
      const spyEmit = jest.spyOn(budgetAlertService, 'checkAndEmit');
      const today = new Date();

      await prisma.budget.create({
        data: {
          userId,
          total: 10000,
          categories: {
            create: {
              categoryId,
              amount: 1000,
              startDate: new Date(today.getFullYear(), today.getMonth(), 1),
              endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0),
              type: 'expense',
            },
          },
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          type: 'expense',
          amount: 900,
          date: today,
        },
      });

      const dto: UpdateTransactionDTO = {
        amount: 1500, // 초과하게 만듦
      };

      await service.update(userId, tx.id, dto);

      expect(spyEmit).toHaveBeenCalled();
    });
  });

  ///////// Delete /////////
  describe('TransactionsService - delete()', () => {
    let service: TransactionsService;
    let prisma: PrismaService;

    let userId: string;
    let accountId: string;
    let categoryId: string;
    let transactionId: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          TransactionsService,
          PrismaService,
          {
            provide: BudgetAlertService,
            useValue: { checkAndEmit: jest.fn() },
          }, // ✅ 추가
        ],
      }).compile();

      service = moduleRef.get(TransactionsService);
      prisma = moduleRef.get(PrismaService);

      const user = await prisma.user.create({
        data: {
          email: `test-${randomUUID()}@test.com`,
          password: 'hashed-password', // ✅ 필수 필드 추가
        },
      });
      userId = user.id;

      const category = await prisma.category.create({
        data: {
          name: '삭제 테스트',
          type: 'expense',
          icon: '🗑️',
          userId,
        },
      });
      categoryId = category.id;

      const account = await prisma.account.create({
        data: {
          name: '삭제 테스트 계좌',
          type: 'CASH',
          balance: 10000,
          userId,
        },
      });
      accountId = account.id;

      const tx = await prisma.transaction.create({
        data: {
          type: 'expense',
          amount: 5000,
          categoryId,
          accountId,
          userId,
          date: new Date(),
        },
      });
      transactionId = tx.id;
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany(); // ✅ 1. 트랜잭션부터
      await prisma.recurringTransaction.deleteMany(); // ✅ 2. 반복 트랜잭션
      await prisma.budgetCategory.deleteMany(); // ✅ 3. FK를 먼저 제거해야 함
      await prisma.budget.deleteMany(); // ✅ 4. 예산 본체
      await prisma.account.deleteMany(); // ✅ 5. 계좌
      await prisma.category.deleteMany(); // ✅ 6. 카테고리 (이제 가능)
      await prisma.user.deleteMany(); // ✅ 7. 유저
    });

    it('should soft delete the transaction and return success message', async () => {
      const result = await service.delete(userId, transactionId);

      expect(result).toEqual({ message: '삭제 완료' });

      const deleted = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      expect(deleted).not.toBeNull();
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      await expect(service.delete(userId, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if transaction belongs to another user', async () => {
      const anotherUser = await prisma.user.create({
        data: { email: `test-${randomUUID()}@test.com`, password: 'pw' },
      });

      const tx = await prisma.transaction.create({
        data: {
          type: 'income',
          amount: 3000,
          categoryId,
          accountId,
          userId: anotherUser.id,
          date: new Date(),
        },
      });

      await expect(service.delete(userId, tx.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if transaction is an opening balance', async () => {
      const tx = await prisma.transaction.create({
        data: {
          type: 'income',
          amount: 10000,
          userId,
          accountId,
          categoryId,
          isOpening: true,
          date: new Date(),
        },
      });

      await expect(service.delete(userId, tx.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
