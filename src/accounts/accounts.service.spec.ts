import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockAccount,
  mockPrismaFactory,
  mockUser,
  mockAccountCreateRequest,
} from '@/tests/mocks/mockHelpers';
import { Account, Prisma } from '@prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(),
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create account and transaction if balance is provided', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      (prisma.account.findUnique as jest.Mock).mockResolvedValueOnce(
        mockAccount,
      ); // 🧩 내부 balance 계산용

      (prisma.$transaction as jest.Mock).mockImplementationOnce(
        async (
          callback: (tx: Prisma.TransactionClient) => Promise<Account>,
        ) => {
          return await callback(prisma);
        },
      );

      (prisma.account.create as jest.Mock).mockResolvedValueOnce(mockAccount);
      (prisma.transaction.create as jest.Mock).mockResolvedValueOnce({
        id: 'tx-id',
      } as any);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([]); // 🧩 계좌 트랜잭션 목록 반환 mock

      const result = await service.create(
        mockUser.id,
        mockAccountCreateRequest,
      );

      expect(result).toEqual(mockAccount);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.create).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.transaction.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all user accounts', async () => {
      (prisma.account.findMany as jest.Mock).mockResolvedValueOnce([
        mockAccount,
      ]);

      const result = await service.findAll(mockUser.id);
      expect(result).toEqual([mockAccount]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' }, // ✅ 실제 서비스 기준
      });
    });
  });

  describe('findOne', () => {
    it('should return an account by ID for the user', async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValueOnce(
        mockAccount,
      );

      const result = await service.findOne(mockUser.id, mockAccount.id);
      expect(result).toEqual(mockAccount);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: mockAccount.id }, // ✅ 실제 서비스는 복합 키 아님
      });
    });
  });

  describe('remove', () => {
    it('should delete the account for the user', async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValueOnce(
        mockAccount,
      ); // ✅ 유저 일치 확인용
      (prisma.account.delete as jest.Mock).mockResolvedValueOnce(mockAccount);

      const result = await service.remove(mockUser.id, mockAccount.id);
      expect(result).toEqual(mockAccount);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.account.delete).toHaveBeenCalledWith({
        where: { id: mockAccount.id },
      });
    });
  });
});
