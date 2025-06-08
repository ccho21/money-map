import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockAccount,
  mockAccountCreateRequest,
  mockUserPayload,
} from '@/mocks/mockHelpers';

const userPayload = mockUserPayload;

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: jest.Mocked<AccountsService>;

  beforeEach(async () => {
    const prismaMock = {} as unknown as PrismaService;

    service = {
      create: jest.fn().mockResolvedValue(mockAccount),
      findAll: jest.fn().mockResolvedValue([mockAccount]),
      findOne: jest.fn().mockResolvedValue(mockAccount),
      update: jest.fn().mockResolvedValue({ ...mockAccount, name: 'Updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
      prisma: prismaMock,
      logger: new Logger(AccountsService.name),
    } as unknown as jest.Mocked<AccountsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: service }],
    }).compile();

    controller = module.get(AccountsController);
  });

  it('create() creates a new account', async () => {
    const spy = jest.spyOn(service, 'create');
    const result = await controller.create(
      mockAccountCreateRequest,
      userPayload,
    );
    expect(result).toEqual(mockAccount);
    expect(spy).toHaveBeenCalledWith(userPayload.id, mockAccountCreateRequest);
  });

  it('findAll() returns all accounts', async () => {
    const spy = jest.spyOn(service, 'findAll');
    const result = await controller.findAll(userPayload);
    expect(result).toEqual([mockAccount]);
    expect(spy).toHaveBeenCalledWith(userPayload.id);
  });

  it('findOne() returns account by id', async () => {
    const spy = jest.spyOn(service, 'findOne');
    const result = await controller.findOne('acc-001', userPayload);
    expect(result).toEqual(mockAccount);
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'acc-001');
  });

  it('update() updates account', async () => {
    const spy = jest.spyOn(service, 'update');
    const result = await controller.update(userPayload, 'acc-001', {
      name: 'Updated',
    });
    expect(result.name).toBe('Updated');
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'acc-001', {
      name: 'Updated',
    });
  });

  it('remove() deletes account', async () => {
    const spy = jest.spyOn(service, 'remove');
    const result = await controller.remove(userPayload, 'acc-001');
    expect(result).toEqual({ success: true });
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'acc-001');
  });
});
