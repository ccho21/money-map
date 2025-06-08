import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockPrismaFactory,
  mockUser,
  mockCategory,
} from '@/mocks/mockHelpers';
import { CategoryCreateRequestDTO } from './dto/category-request.dto';
import { CategoryType } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(),
        },
        CategoriesService,
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category for the user', async () => {
      const dto: CategoryCreateRequestDTO = {
        name: mockCategory.name,
        icon: mockCategory.icon,
        type: mockCategory.type as CategoryType,
        color: mockCategory.color,
      };

      (prisma.category.create as jest.Mock).mockResolvedValueOnce(mockCategory);

      const result = await service.create(mockUser.id, dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { ...dto, userId: mockUser.id },
      });
      expect(result).toEqual(mockCategory);
    });
  });
});
