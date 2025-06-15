import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CategoryCreateRequestDTO,
  CategoryUpdateRequestDTO,
} from './dto/category-request.dto';
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 카테고리 생성
  async create(userId: string, dto: CategoryCreateRequestDTO) {
    this.logger.debug(`📂 Creating category: ${dto.name} for user: ${userId}`);

    const category = await this.prisma.category.create({
      data: {
        ...dto,
        userId,
      },
    });

    this.logger.log(`✅ Created category: ${category.id}`);
    return category;
  }

  // 유저 카테고리 전체 조회
  async findAllByUser(userId: string) {
    this.logger.debug(`🔍 Fetching categories for user: ${userId}`);
    return this.prisma.category.findMany({
      where: { userId },
    });
  }

  // 특정 카테고리 조회
  async findOne(userId: string, id: string) {
    this.logger.debug(`🔍 Fetching category ${id} for user: ${userId}`);

    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      this.logger.warn(`❌ Category not found or unauthorized access`);
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    return category;
  }

  // 카테고리 수정
  async update(userId: string, id: string, dto: CategoryUpdateRequestDTO) {
    this.logger.debug(`✏️ Updating category ${id} for user: ${userId}`);

    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      this.logger.warn(`❌ Category not found`);
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    if (category.userId !== userId) {
      this.logger.warn(`❌ Unauthorized update attempt`);
      throw new ForbiddenException('카테고리를 수정할 권한이 없습니다.');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        icon: dto.icon,
        type: dto.type,
        color: dto.color,
      },
    });

    this.logger.log(`✅ Updated category: ${id}`);
    return updated;
  }

  // 카테고리 삭제
  async delete(userId: string, categoryId: string) {
    this.logger.debug(`🗑️ Deleting category ${categoryId} by user: ${userId}`);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      this.logger.warn(`❌ Category not found`);
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    if (category.userId !== userId) {
      this.logger.warn(`❌ Unauthorized delete attempt`);
      throw new ForbiddenException('카테고리를 삭제할 권한이 없습니다.');
    }

    const deleted = await this.prisma.category.delete({
      where: { id: categoryId },
    });

    this.logger.log(`✅ Deleted category: ${categoryId}`);
    return deleted;
  }
}
