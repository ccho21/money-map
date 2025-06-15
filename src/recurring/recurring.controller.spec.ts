import { Test, TestingModule } from '@nestjs/testing';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { mockUserPayload } from '@/mocks/mockHelpers';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';

const user = mockUserPayload;

describe('RecurringController (unit)', () => {
  let controller: RecurringController;
  let service: jest.Mocked<RecurringService>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'rec' }),
      softDelete: jest.fn().mockResolvedValue({ message: '삭제 완료' }),
    } as unknown as jest.Mocked<RecurringService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringController],
      providers: [{ provide: RecurringService, useValue: service }],
    }).compile();

    controller = module.get(RecurringController);
  });

  it('createRecurring() calls service with user id', async () => {
    const dto = {
      accountId: 'a',
      type: 'expense',
      amount: 1,
      startDate: '2024-01-01',
      frequency: 'daily',
    } as CreateRecurringTransactionDto;
    const spy = jest.spyOn(service, 'create');
    const result = await controller.createRecurring(user, dto);

    expect(result.id).toBe('rec');
    expect(spy).toHaveBeenCalledWith(user.id, dto);
  });

  it('softDeleteRecurring() calls service', async () => {
    const spy = jest.spyOn(service, 'softDelete');
    const result = await controller.softDeleteRecurring(user, 'r');
    expect(result.message).toBe('삭제 완료');
    expect(spy).toHaveBeenCalledWith(user.id, 'r');
  });
});
