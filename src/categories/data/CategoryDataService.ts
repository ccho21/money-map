// 📁 src/modules/category/data/CategoryDataService.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoryDetailDTO } from '../dto/category-detail.dto';

@Injectable()
export class CategoryDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategoryById(categoryId: string): Promise<CategoryDetailDTO> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    return {
      id: category.id,
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
    };
  }
}
