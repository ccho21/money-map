import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { CategoriesService } from './categories.service';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@GetUser() user, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.sub, dto);
  }

  @Get()
  findAll(@GetUser() user) {
    return this.categoriesService.findAllByUser(user.sub);
  }

  @Delete(':id')
  remove(@GetUser() user, @Param('id') id: string) {
    return this.categoriesService.delete(user.sub, id);
  }
}
