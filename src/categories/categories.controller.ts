import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { CategoriesService } from './categories.service';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { UserPayload } from 'src/auth/types/user-payload.type';
import { CategoryUpdateDTO } from './dto/category-update.dto';
import { CategoryCreateDTO } from './dto/category-create.dto';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@GetUser() user: UserPayload, @Body() dto: CategoryCreateDTO) {
    return this.categoriesService.create(user.id, dto);
  }

  @Get()
  findAll(@GetUser() user: UserPayload) {
    return this.categoriesService.findAllByUser(user.id);
  }

  @Get(':id')
  findOne(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @GetUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: CategoryUpdateDTO,
  ) {
    return this.categoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@GetUser() user: UserPayload, @Param('id') id: string) {
    return this.categoriesService.delete(user.id, id);
  }
}
