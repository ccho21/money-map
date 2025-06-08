import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import {
  mockAccount,
  mockAccountCreateRequest,
  mockUserPayload,
} from '@/mocks/mockHelpers';
import { AccountUpdateRequestDTO } from './dto/account-request.dto';

const userPayload = mockUserPayload;

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: jest.Mocked<AccountsService>;

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<AccountsService>> = {
      create: jest.fn().mockResolvedValue(mockAccount),
      findAll: jest.fn().mockResolvedValue([mockAccount]),
      findOne: jest.fn().mockResolvedValue(mockAccount),
      update: jest.fn().mockResolvedValue({ ...mockAccount, name: 'Updated' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: mockService }],
    }).compile();

    controller = module.get(AccountsController);
    service = module.get(AccountsService);
  });

  it('create() creates a new account', async () => {
    const result = await controller.create(
      mockAccountCreateRequest,
      userPayload,
    );
    expect(result).toEqual(mockAccount);
    expect(service.create.bind(service)).toHaveBeenCalledWith(
      userPayload.id,
      mockAccountCreateRequest,
    );
  });

  it('findAll() returns all accounts', async () => {
    const result = await controller.findAll(userPayload);
    expect(result).toEqual([mockAccount]);
    expect(service.findAll.bind(service)).toHaveBeenCalledWith(userPayload.id);
  });

  it('findOne() returns account by id', async () => {
    const result = await controller.findOne('acc-001', userPayload);
    expect(result).toEqual(mockAccount);
    expect(service.findOne.bind(service)).toHaveBeenCalledWith(
      userPayload.id,
      'acc-001',
    );
  });

  it('update() updates account', async () => {
    const dto: AccountUpdateRequestDTO = { name: 'Updated' };
    const result = await controller.update(userPayload, 'acc-001', dto);
    expect(result.name).toBe('Updated');
    expect(service.update.bind(service)).toHaveBeenCalledWith(
      userPayload.id,
      'acc-001',
      dto,
    );
  });

  it('remove() deletes account', async () => {
    const result = await controller.remove(userPayload, 'acc-001');
    expect(result).toEqual({ success: true });
    expect(service.remove.bind(service)).toHaveBeenCalledWith(
      userPayload.id,
      'acc-001',
    );
  });
});
