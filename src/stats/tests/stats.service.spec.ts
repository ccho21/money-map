// 📄 src/stats/tests/stats.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../stats.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  mockPrismaFactory,
  mockStatsQuery,
  mockTransaction,
  mockTransactionGroupByResult,
  mockCategory,
  mockBudgetCategory,
  mockUser,
} from '@/tests/mocks/mockHelpers';

jest.mock('@/libs/timezone', () => ({
  getUserTimezone: jest.fn().mockReturnValue('UTC'),
}));

jest.mock('@/libs/date.util', () => ({
  getUTCStartDate: jest.fn().mockReturnValue(new Date('2023-01-01T00:00:00Z')),
  getUTCEndDate: jest.fn().mockReturnValue(new Date('2023-01-31T23:59:59Z')),
}));

describe('StatsService', () => {
  let service: StatsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  describe('getByCategory', () => {
    it('should throw BadRequestException if required fields are missing', async () => {
      const invalidQuery = { startDate: '2023-01-01' };
      await expect(
        service.getByCategory('user-123', invalidQuery as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(
        service.getByCategory('invalid-user', mockStatsQuery),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return category stats for valid input', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.category, 'findMany').mockResolvedValue([mockCategory]);
      jest
        .spyOn(prisma.transaction, 'groupBy')
        .mockResolvedValue([mockTransactionGroupByResult]);
      jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
      jest
        .spyOn(prisma.budgetCategory, 'findMany')
        .mockResolvedValue([mockBudgetCategory]);

      const result = await service.getByCategory('user-123', mockStatsQuery);
      expect(result).toBeDefined();
    });
  });

  describe('getByBudget', () => {
    it('should throw BadRequestException if required fields are missing', async () => {
      const invalidQuery = { endDate: '2023-01-31' };
      await expect(
        service.getByBudget('user-456', invalidQuery as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user is not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(
        service.getByBudget('ghost-user', mockStatsQuery),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return budget stats for valid input', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.category, 'findMany').mockResolvedValue([mockCategory]);
      jest
        .spyOn(prisma.budgetCategory, 'findMany')
        .mockResolvedValue([mockBudgetCategory]);
      jest
        .spyOn(prisma.transaction, 'groupBy')
        .mockResolvedValue([mockTransactionGroupByResult]);
      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue([mockTransaction]);

      const result = await service.getByBudget('user-456', mockStatsQuery);
      expect(result).toBeDefined();
    });
  });

  describe('getStatsByNoteSummary', () => {
    it('should throw BadRequestException if required fields are missing', async () => {
      const invalidQuery = { startDate: '2023-01-01' };
      await expect(
        service.getStatsByNoteSummary('user-789', invalidQuery as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(
        service.getStatsByNoteSummary('ghost-user', mockStatsQuery),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return note summary for valid input', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(prisma.transaction, 'findMany')
        .mockResolvedValue([mockTransaction]);

      const spy = jest.spyOn(prisma.transaction, 'findMany');
      const result = await service.getStatsByNoteSummary(
        'user-789',
        mockStatsQuery,
      );
      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalled();
    });
  });
});
