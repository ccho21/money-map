import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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

  async findOne(userId: string, id: string) {
    this.logger.debug(`🔍 Finding category ${id} for user: ${userId}`);

    const category = await this.prisma.category.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!category) {
      this.logger.warn(`❌ Category not found or access denied`);
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    this.logger.debug(`✏️ Updating category ${id} for user: ${userId}`);

    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category || category.userId !== userId) {
      this.logger.warn(`❌ Unauthorized update attempt`);
      throw new ForbiddenException('수정 권한 없음');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ?? category.name,
        icon: dto.icon ?? category.icon,
        type: dto.type ?? category.type,
      },
    });

    this.logger.log(`✅ Category updated: ${id}`);
    return updated;
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
