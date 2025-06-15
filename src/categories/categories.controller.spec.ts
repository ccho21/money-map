import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import {
  CategoryCreateRequestDTO,
  CategoryUpdateRequestDTO,
} from './dto/category-request.dto';
import { mockUserPayload, mockCategory } from '@/mocks/mockHelpers';

describe('CategoriesController (unit)', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockCategory),
      findAllByUser: jest.fn().mockResolvedValue([mockCategory]),
      findOne: jest.fn().mockResolvedValue(mockCategory),
      update: jest.fn().mockResolvedValue({ ...mockCategory, name: 'Updated' }),
      delete: jest.fn().mockResolvedValue(mockCategory),
    } as unknown as jest.Mocked<CategoriesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();

    controller = module.get(CategoriesController);
  });

  it('create() calls service with user id', async () => {
    const dto: CategoryCreateRequestDTO = {
      name: mockCategory.name,
      icon: mockCategory.icon,
      type: mockCategory.type,
      color: mockCategory.color,
    };

    const spy = jest.spyOn(service, 'create');
    const result = await controller.create(mockUserPayload, dto);

    expect(result).toEqual(mockCategory);
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, dto);
  });

  it('findAll() returns all user categories', async () => {
    const spy = jest.spyOn(service, 'findAllByUser');
    const result = await controller.findAll(mockUserPayload);

    expect(result).toEqual([mockCategory]);
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id);
  });

  it('findOne() returns single category', async () => {
    const spy = jest.spyOn(service, 'findOne');

    const result = await controller.findOne(mockUserPayload, mockCategory.id);

    expect(result).toEqual(mockCategory);
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, mockCategory.id);
  });

  it('update() updates category', async () => {
    const dto: CategoryUpdateRequestDTO = { name: 'Updated' };

    const spy = jest.spyOn(service, 'update');
    const result = await controller.update(
      mockUserPayload,
      mockCategory.id,
      dto,
    );

    expect(result.name).toBe('Updated');
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, mockCategory.id, dto);
  });

  it('remove() deletes a category', async () => {
    const spy = jest.spyOn(service, 'delete');
    const result = await controller.remove(mockUserPayload, mockCategory.id);

    expect(result).toEqual(mockCategory);
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, mockCategory.id);
  });
});
