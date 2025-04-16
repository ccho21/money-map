import { CategoriesService } from '@/categories/categories.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockPrismaFactory } from '@/tests/mocks/mockHelpers';
import { Test, TestingModule } from '@nestjs/testing';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaFactory(), // ✅ 여기가 핵심
        },
        CategoriesService,
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
