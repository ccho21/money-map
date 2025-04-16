import { getTransactionDelta } from "./getTransactionDelta.util";

describe('getTransactionDelta', () => {
  it('should return positive delta when amount increased', () => {
    const before = { amount: 5000 };
    const after = { amount: 8000 };
    const delta = getTransactionDelta(before, after);
    expect(delta).toBe(3000);
  });

  it('should return negative delta when amount decreased', () => {
    const before = { amount: 8000 };
    const after = { amount: 3000 };
    const delta = getTransactionDelta(before, after);
    expect(delta).toBe(-5000);
  });

  it('should return 0 when amount did not change', () => {
    const before = { amount: 5000 };
    const after = { amount: 5000 };
    const delta = getTransactionDelta(before, after);
    expect(delta).toBe(0);
  });

  it('should return 0 when after amount is undefined', () => {
    const before = { amount: 4200 };
    const after = {};
    const delta = getTransactionDelta(before, after);
    expect(delta).toBe(0);
  });

  it('should work when afterDto is a Partial<TransactionUpdateRequestDTO>', () => {
    const before = { amount: 2500 };
    const afterDto = { note: 'updated', amount: 4000 };
    const delta = getTransactionDelta(before, afterDto);
    expect(delta).toBe(1500);
  });
});