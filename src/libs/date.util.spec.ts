import {
  getCardBillingRange,
  getDateRangeAndLabelByGroup,
} from '@/libs/date.util';

import { GroupBy } from '@/common/types/types';

describe('getDateRangeAndLabelByGroup', () => {
  const timezone = 'Asia/Seoul';
  const baseDate = new Date('2024-01-15T12:00:00Z'); // 기준 날짜

  it('should return correct label and range for daily', () => {
    const result = getDateRangeAndLabelByGroup(
      baseDate,
      GroupBy.DAILY,
      timezone,
    );
    expect(result.label).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(result.rangeStart).toBeInstanceOf(Date);
    expect(result.rangeEnd).toBeInstanceOf(Date);
  });

  it('should return correct label and range for weekly', () => {
    const result = getDateRangeAndLabelByGroup(
      baseDate,
      GroupBy.WEEKLY,
      timezone,
    );
    expect(result.label).toMatch(/\d{4}-\d{2}-\d{2}/); // ✅ 주 시작 날짜 형식
    expect(result.rangeStart).toBeInstanceOf(Date);
    expect(result.rangeEnd).toBeInstanceOf(Date);
  });

  it('should return correct label and range for monthly', () => {
    const result = getDateRangeAndLabelByGroup(
      baseDate,
      GroupBy.MONTHLY,
      timezone,
    );
    expect(result.label).toMatch(/Jan|2024-01/);
    expect(result.rangeStart).toBeInstanceOf(Date);
    expect(result.rangeEnd).toBeInstanceOf(Date);
  });

  it('should return correct label and range for yearly', () => {
    const result = getDateRangeAndLabelByGroup(
      baseDate,
      GroupBy.YEARLY,
      timezone,
    );
    expect(result.label).toBe('2024');
    expect(result.rangeStart).toBeInstanceOf(Date);
    expect(result.rangeEnd).toBeInstanceOf(Date);
  });

  describe('getCardBillingRange', () => {
    it('should return correct range for normal month (15일 정산)', () => {
      const now = new Date('2024-03-20');
      const { billingStart, billingEnd } = getCardBillingRange(now, 15);

      expect(billingStart.toISOString().slice(0, 10)).toBe('2024-02-16');
      expect(billingEnd.toISOString().slice(0, 10)).toBe('2024-03-15');
    });

    it('should handle settlement date 31 on short month (2월)', () => {
      const now = new Date('2024-03-05'); // 윤년
      const { billingStart, billingEnd } = getCardBillingRange(now, 31);

      expect(billingStart.toISOString().slice(0, 10)).toBe('2024-03-01'); // 1월 31 → 2월 1일 시작
      expect(billingEnd.toISOString().slice(0, 10)).toBe('2024-03-31');
    });

    it('should calculate correctly around new year', () => {
      const now = new Date('2024-01-10');
      const { billingStart, billingEnd } = getCardBillingRange(now, 10);

      expect(billingStart.toISOString().slice(0, 10)).toBe('2023-12-11');
      expect(billingEnd.toISOString().slice(0, 10)).toBe('2024-01-10');
    });

    it('should adjust start date after prev month settlement', () => {
      const now = new Date('2024-04-30');
      const { billingStart, billingEnd } = getCardBillingRange(now, 25);

      expect(billingStart.toISOString().slice(0, 10)).toBe('2024-03-26');
      expect(billingEnd.toISOString().slice(0, 10)).toBe('2024-04-25');
    });
  });
});
