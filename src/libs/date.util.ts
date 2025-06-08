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
import { Timeframe } from '@/transactions/dto/params/transaction-group-query.dto';

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

export function getValidDay(year: number, month: number, day: number): number {
  const lastDate = lastDayOfMonth(new Date(year, month - 1)).getDate();
  return Math.min(day, lastDate);
}

export function getDateRangeList(
  date: Date,
  timeFrame: Timeframe,
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

    switch (timeFrame) {
      case 'daily':
        current = addDays(centerDate, i);
        startDate = startOfDay(current);
        endDate = endOfDay(current);
        label = format(current, 'MM-dd');
        isCurrent = isSameDay(current, centerDate);
        break;

      case 'weekly':
        current = addWeeks(centerDate, i);
        startDate = startOfWeek(current, { weekStartsOn: 0 });
        endDate = endOfWeek(current, { weekStartsOn: 0 });
        label = format(startDate, 'MM/dd');
        isCurrent = isSameWeek(current, centerDate, { weekStartsOn: 0 });
        break;

      case 'monthly':
        current = addMonths(centerDate, i);
        startDate = startOfMonth(current);
        endDate = endOfMonth(current);
        label = format(current, 'MMM');
        isCurrent = isSameMonth(current, centerDate);
        break;

      case 'yearly':
        current = addYears(centerDate, i);
        startDate = startOfYear(current);
        endDate = endOfYear(current);
        label = format(current, 'yyyy');
        isCurrent = isSameYear(current, centerDate);
        break;

      default:
        throw new Error('Invalid Timeframe');
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
