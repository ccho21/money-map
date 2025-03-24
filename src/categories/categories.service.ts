import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    this.logger.debug(
      `📂 Creating category for user: ${userId}, name: ${dto.name}`,
    );
    const category = await this.prisma.category.create({
      data: {
        ...dto,
        userId,
      },
    });
    this.logger.log(`✅ Category created: ${category.id}`);
    return category;
  }

  async findAllByUser(userId: string) {
    this.logger.debug(`🔍 Retrieving categories for user: ${userId}`);
    return this.prisma.category.findMany({
      where: { userId },
    });
  }

  async delete(userId: string, categoryId: string) {
    this.logger.debug(
      `🗑️ Attempting to delete category: ${categoryId} by user: ${userId}`,
    );

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.userId !== userId) {
      this.logger.warn(
        `❌ Unauthorized delete attempt by user: ${userId} for category: ${categoryId}`,
      );
      throw new ForbiddenException('삭제 권한 없음');
    }

    const deleted = await this.prisma.category.delete({
      where: { id: categoryId },
    });

    this.logger.log(`✅ Category deleted: ${categoryId}`);
    return deleted;
  }
}
