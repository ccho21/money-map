// 📄 경로: src/libs/date.util.ts
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import {
  startOfDay,
  endOfDay,
  endOfWeek,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  isSameDay,
  addWeeks,
  isSameWeek,
  addMonths,
  isSameMonth,
  addYears,
  isSameYear,
  lastDayOfMonth,
  subMonths,
  subDays,
  subWeeks,
  subYears,
} from 'date-fns';
import { GroupBy } from '@/common/types/types';
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';

/**
 * 유저 타임존 기준 → UTC로 변환해서 DB 저장 시 사용
 */
export function toUTC(date: Date | string, timezone: string): Date {
  return toZonedTime(date, timezone); // 로컬시간 → UTC
}

/**
 * UTC 날짜를 유저 타임존으로 변환해서 프론트로 반환할 때 사용
 */
export function fromUTC(utcDate: Date | string, timezone: string): Date {
  return toZonedTime(utcDate, timezone); // UTC → 로컬시간
}

/**
 * get local timezoned date with 00:00
 */
export function getUTCStartDate(dateStr: string, timezone: string) {
  const startLocal = startOfDay(fromZonedTime(`${dateStr}T00:00:00`, timezone));
  return fromZonedTime(startLocal, timezone);
}
/**
 * get local timezoned date with 23:59
 */
export function getUTCEndDate(dateStr: string, timezone: string) {
  const localEnd = endOfDay(fromZonedTime(`${dateStr}T00:00:00`, timezone));
  return fromZonedTime(localEnd, timezone);
}

export function getLocalStartDate(dateStr: string, timezone: string) {
  const localStart = startOfDay(fromZonedTime(`${dateStr}T00:00:00`, timezone));
  return toZonedTime(localStart, timezone);
}

export function getLocalEndDate(dateStr: string, timezone: string) {
  const localEnd = endOfDay(fromZonedTime(`${dateStr}T00:00:00`, timezone));
  return toZonedTime(localEnd, timezone);
}

export function getValidDay(year: number, month: number, day: number): number {
  const lastDate = lastDayOfMonth(new Date(year, month - 1)).getDate();
  return Math.min(day, lastDate);
}

export function getDateRangeAndLabelByGroup(
  date: Date,
  timeFrame: Timeframe,
  timezone: string,
) {
  let rangeStart: Date;
  let rangeEnd: Date;
  let label: string;
  const zonedDate = toZonedTime(date, timezone);
  switch (timeFrame) {
    case GroupBy.DAILY:
      rangeStart = startOfDay(zonedDate);
      rangeEnd = endOfDay(zonedDate);
      label = format(rangeStart, 'yyyy-MM-dd');
      break;
    case GroupBy.WEEKLY:
      rangeStart = startOfWeek(zonedDate, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(zonedDate, { weekStartsOn: 0 });
      label = format(rangeStart, 'yyyy-MM-dd');
      break;
    case GroupBy.MONTHLY:
      rangeStart = startOfMonth(zonedDate);
      rangeEnd = endOfMonth(zonedDate);
      label = format(rangeStart, 'yyyy-MM');
      break;
    case GroupBy.YEARLY:
      rangeStart = startOfYear(zonedDate);
      rangeEnd = endOfYear(zonedDate);
      label = format(rangeStart, 'yyyy');
      break;
    default:
      throw new Error('Invalid groupBy');
  }
  return { rangeStart, rangeEnd, label };
}

export function getDateRangeList(
  date: Date,
  groupBy: Timeframe,
  timezone: string,
) {
  const centerDate = toZonedTime(date, timezone);
  const rangeList: {
    label: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }[] = [];

  for (let i = -5; i <= 6; i++) {
    let current: Date;
    let startDate: Date;
    let endDate: Date;
    let label: string;
    let isCurrent = false;

    switch (groupBy) {
      case GroupBy.DAILY:
        current = addDays(centerDate, i);
        startDate = startOfDay(current);
        endDate = endOfDay(current);
        label = format(current, 'MM-dd');
        isCurrent = isSameDay(current, centerDate);
        break;

      case GroupBy.WEEKLY:
        current = addWeeks(centerDate, i);
        startDate = startOfWeek(current, { weekStartsOn: 0 });
        endDate = endOfWeek(current, { weekStartsOn: 0 });
        label = format(startDate, 'MM/dd');
        isCurrent = isSameWeek(current, centerDate, { weekStartsOn: 0 });
        break;

      case GroupBy.MONTHLY:
        current = addMonths(centerDate, i);
        startDate = startOfMonth(current);
        endDate = endOfMonth(current);
        label = format(current, 'MMM');
        isCurrent = isSameMonth(current, centerDate);
        break;

      case GroupBy.YEARLY:
        current = addYears(centerDate, i);
        startDate = startOfYear(current);
        endDate = endOfYear(current);
        label = format(current, 'yyyy');
        isCurrent = isSameYear(current, centerDate);
        break;

      default:
        throw new Error('Invalid groupBy');
    }

    rangeList.push({
      label,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      isCurrent,
    });
  }

  return rangeList;
}

export function getCardBillingRange(
  now: Date,
  settlementDate: number,
): { billingStart: Date; billingEnd: Date } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 이번달 정산일
  const thisMonthSettlementDay = getValidDay(year, month, settlementDate);
  const settlementDateThisMonth = new Date(
    year,
    month - 1,
    thisMonthSettlementDay,
  );

  const previousMonth = subMonths(now, 1);
  const prevSettlementDay = getValidDay(
    previousMonth.getFullYear(),
    previousMonth.getMonth() + 1,
    settlementDate,
  );
  const settlementDatePrevMonth = new Date(
    previousMonth.getFullYear(),
    previousMonth.getMonth(),
    prevSettlementDay,
  );

  const billingStart = new Date(settlementDatePrevMonth);
  billingStart.setDate(billingStart.getDate() + 1); // 정산일 다음날부터

  return {
    billingStart,
    billingEnd: settlementDateThisMonth,
  };
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function getPreviousPeriod(
  timeframe: Timeframe,
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  switch (timeframe) {
    case 'daily':
      return {
        start: subDays(start, 1),
        end: subDays(end, 1),
      };
    case 'weekly':
      return {
        start: subWeeks(start, 1),
        end: subWeeks(end, 1),
      };
    case 'monthly':
      return {
        start: subMonths(start, 1),
        end: subMonths(end, 1),
      };
    case 'yearly':
      return {
        start: subYears(start, 1),
        end: subYears(end, 1),
      };
    default:
      throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
}
