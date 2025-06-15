import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsTransferService } from './transfer.service';
import { TransactionsAnalysisService } from './analysis.service';
import {
  mockCreateTransactionDto,
  mockUpdateTransactionDto,
  mockTransferTransactionDto,
  mockTransaction,
  mockUserPayload,
} from '@/mocks/mockHelpers';
import { TransactionGroupQueryDTO } from './dto/params/transaction-group-query.dto';

const userPayload = mockUserPayload;

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let transactionService: jest.Mocked<TransactionsService>;
  let transferService: jest.Mocked<TransactionsTransferService>;
  let analysisService: jest.Mocked<TransactionsAnalysisService>;

  beforeEach(async () => {
    transactionService = {
      create: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionById: jest.fn().mockResolvedValue(mockTransaction),
      update: jest.fn().mockResolvedValue({ ...mockTransaction, amount: 999 }),
      delete: jest.fn().mockResolvedValue({ message: 'ok' }),
    } as unknown as jest.Mocked<TransactionsService>;

    transferService = {
      createTransfer: jest.fn().mockResolvedValue({
        outgoing: { id: 'out' },
        incoming: { id: 'in' },
      }),
      updateTransfer: jest
        .fn()
        .mockResolvedValue({ updatedOutgoing: {}, updatedIncoming: {} }),
      deleteTransfer: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as jest.Mocked<TransactionsTransferService>;

    analysisService = {
      getTransactionSummary: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        groupBy: 'date',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        totalIncome: 100,
        totalExpense: 50,
        netBalance: 50,
      }),
      getGroupedTransactions: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'date',
        groups: [],
      }),
      getTransactionCalendarView: jest
        .fn()
        .mockResolvedValue([{ date: '2024-04-10', income: 0, expense: 100 }]),
      getRecommendedKeywords: jest.fn().mockResolvedValue(['coffee', 'lunch']),
      getChartFlow: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        insights: [],
        periods: [],
      }),
      getChartCategory: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        topCategories: [],
      }),
      getChartAccount: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        accounts: [],
        insights: [],
      }),
      getChartBudget: jest.fn().mockResolvedValue({
        timeframe: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        totalBudget: 0,
        totalUsed: 0,
        usageRate: 0,
        overBudget: false,
        overCategoryCount: 0,
        breakdown: [],
      }),
    } as unknown as jest.Mocked<TransactionsAnalysisService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: transactionService },
        { provide: TransactionsTransferService, useValue: transferService },
        { provide: TransactionsAnalysisService, useValue: analysisService },
      ],
    }).compile();

    controller = module.get(TransactionsController);
  });
  it('create() should delegate to service', async () => {
    const spy = jest.spyOn(transactionService, 'create');
    const result = await controller.create(
      mockUserPayload,
      mockCreateTransactionDto,
    );
    expect(result).toEqual(mockTransaction);
    expect(spy).toHaveBeenCalledWith(
      mockUserPayload.id,
      mockCreateTransactionDto,
    );
  });

  it('getSummary() should return summary', async () => {
    const query: TransactionGroupQueryDTO = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    const spy = jest.spyOn(analysisService, 'getTransactionSummary');

    const result = await controller.getSummary(userPayload, query);

    expect(result.startDate).toBe('2024-01-01');
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getGroupedTransactions() should return grouped data', async () => {
    const query: TransactionGroupQueryDTO = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    const spy = jest.spyOn(analysisService, 'getGroupedTransactions');

    const result = await controller.getGroupedTransactions(userPayload, query);

    expect(result.groups).toBeDefined();
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getCalendarView() should return calendar items', async () => {
    const query = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    } as TransactionGroupQueryDTO;
    const spy = jest.spyOn(analysisService, 'getTransactionCalendarView');

    const result = await controller.getCalendarView(userPayload, query);
    expect(result[0].date).toBe('2024-04-10');
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getKeywords() should return keyword list', async () => {
    const spy = jest.spyOn(analysisService, 'getRecommendedKeywords');

    const result = await controller.getKeywords(userPayload);
    expect(result).toEqual(['coffee', 'lunch']);
    expect(spy).toHaveBeenCalledWith(userPayload.id);
  });

  it('getChartFlow() returns flow chart data', async () => {
    const query = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    } as TransactionGroupQueryDTO;

    const result = await controller.getChartFlow(userPayload, query);
    const spy = jest.spyOn(analysisService, 'getChartFlow');

    expect(result.periods).toEqual([]);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getChartCategory() returns category chart data', async () => {
    const query = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    } as TransactionGroupQueryDTO;

    const result = await controller.getChartCategory(userPayload, query);
    const spy = jest.spyOn(analysisService, 'getChartCategory');

    expect(result.topCategories).toEqual([]);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getChartAccount() returns account chart data', async () => {
    const query: TransactionGroupQueryDTO = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    const spy = jest.spyOn(analysisService, 'getChartAccount');

    const result = await controller.getChartAccount(userPayload, query);

    expect(result.accounts).toEqual([]);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('getChartBudget() returns budget chart data', async () => {
    const query = {
      timeframe: 'monthly',
      groupBy: 'date',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    } as TransactionGroupQueryDTO;

    const spy = jest.spyOn(analysisService, 'getChartBudget');
    const result = await controller.getChartBudget(userPayload, query);
    expect(result.totalBudget).toBe(0);
    expect(spy).toHaveBeenCalledWith(userPayload.id, query);
  });

  it('createTransfer() delegates to transfer service', async () => {
    const spy = jest.spyOn(transferService, 'createTransfer');
    const result = await controller.createTransfer(
      mockTransferTransactionDto,
      userPayload,
    );

    expect(result.outgoing.id).toBe('out');
    expect(spy).toHaveBeenCalledWith(
      userPayload.id,
      mockTransferTransactionDto,
    );
  });

  it('updateTransfer() delegates to transfer service', async () => {
    const spy = jest.spyOn(transferService, 'updateTransfer');
    const result = await controller.updateTransfer(
      'tx1',
      mockUpdateTransactionDto,
      userPayload,
    );
    expect(result.updatedOutgoing).toBeDefined();
    expect(spy).toHaveBeenCalledWith(
      userPayload.id,
      'tx1',
      mockUpdateTransactionDto,
    );
  });

  it('deleteTransfer() delegates to transfer service', async () => {
    const spy = jest.spyOn(transferService, 'deleteTransfer');

    const result = await controller.deleteTransfer('tx1', userPayload);

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'tx1');
  });

  it('findOne() returns a transaction', async () => {
    const spy = jest.spyOn(transactionService, 'getTransactionById');

    const result = await controller.findOne(userPayload, 'tx1');
    expect(result).toEqual(mockTransaction);
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'tx1');
  });

  it('update() should update transaction', async () => {
    const spy = jest.spyOn(transactionService, 'update');

    const result = await controller.update(
      userPayload,
      'tx1',
      mockUpdateTransactionDto,
    );
    expect(result.amount).toBe(999);
    expect(spy).toHaveBeenCalledWith(
      userPayload.id,
      'tx1',
      mockUpdateTransactionDto,
    );
  });

  it('delete() should delete transaction', async () => {
    const spy = jest.spyOn(transactionService, 'delete');

    const result = await controller.delete(userPayload, 'tx1');
    expect(result).toEqual({ message: 'ok' });
    expect(spy).toHaveBeenCalledWith(userPayload.id, 'tx1');
  });
});
