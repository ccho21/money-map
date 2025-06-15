import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory, mockUser, mockCategory } from '@/mocks/mockHelpers';
import {
  CategoryCreateRequestDTO,
  CategoryUpdateRequestDTO,
} from './dto/category-request.dto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';

describe('CategoriesService (unit)', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
      ],
    }).compile();

    service = module.get(CategoriesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('service defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a new category', async () => {
      const spy = jest.spyOn(prisma.category, 'create');

      const dto: CategoryCreateRequestDTO = {
        name: mockCategory.name,
        icon: mockCategory.icon,
        type: mockCategory.type,
        color: mockCategory.color,
      };

      spy.mockResolvedValueOnce(mockCategory);

      const result = await service.create(mockUser.id, dto);

      expect(result).toEqual(mockCategory);
      expect(spy).toHaveBeenCalledWith({
        data: { ...dto, userId: mockUser.id },
      });
    });
  });

  describe('findAllByUser', () => {
    it('returns all categories for user', async () => {
      const spy = jest.spyOn(prisma.category, 'findMany');

      spy.mockResolvedValueOnce([mockCategory] as Category[]);

      const result = await service.findAllByUser(mockUser.id);

      expect(result).toEqual([mockCategory]);
      expect(spy).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
    });
  });

  describe('findOne', () => {
    it('returns category when found', async () => {
      const spy = jest.spyOn(prisma.category, 'findFirst');
      spy.mockResolvedValueOnce(mockCategory);

      const result = await service.findOne(mockUser.id, mockCategory.id);

      expect(result).toEqual(mockCategory);
      expect(spy).toHaveBeenCalledWith({
        where: { id: mockCategory.id, userId: mockUser.id },
      });
    });

    it('throws NotFoundException when missing', async () => {
      const spy = jest.spyOn(prisma.category, 'findFirst');
      spy.mockResolvedValueOnce(null);

      await expect(service.findOne(mockUser.id, 'bad')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const dto: CategoryUpdateRequestDTO = { name: 'Updated' };

    it('updates category if authorized', async () => {
      jest
        .spyOn(prisma.category, 'findUnique')
        .mockResolvedValueOnce(mockCategory);

      jest.spyOn(prisma.category, 'update').mockResolvedValueOnce({
        ...mockCategory,
        name: 'Updated',
      });

      const updateSpy = jest.spyOn(prisma.category, 'update');
      const result = await service.update(mockUser.id, mockCategory.id, dto);

      expect(result.name).toBe('Updated');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockCategory.id },
        data: {
          name: dto.name,
          icon: dto.icon,
          type: dto.type,
          color: dto.color,
        },
      });
    });

    it('throws NotFoundException when category missing', async () => {
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        service.update(mockUser.id, mockCategory.id, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when unauthorized', async () => {
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce({
        ...mockCategory,
        userId: 'other',
      });

      await expect(
        service.update(mockUser.id, mockCategory.id, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('removes category when authorized', async () => {
      jest
        .spyOn(prisma.category, 'findUnique')
        .mockResolvedValueOnce(mockCategory);

      jest.spyOn(prisma.category, 'delete').mockResolvedValueOnce(mockCategory);

      const spy = jest.spyOn(prisma.category, 'delete');
      const result = await service.delete(mockUser.id, mockCategory.id);

      expect(result).toEqual(mockCategory);
      expect(spy).toHaveBeenCalledWith({
        where: { id: mockCategory.id },
      });
    });

    it('throws NotFoundException when category missing', async () => {
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        service.delete(mockUser.id, mockCategory.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when unauthorized', async () => {
      jest.spyOn(prisma.category, 'findUnique').mockResolvedValueOnce({
        ...mockCategory,
        userId: 'other',
      });

      await expect(
        service.delete(mockUser.id, mockCategory.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
