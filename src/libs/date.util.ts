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
} from 'date-fns';

/**
 * 유저 타임존 기준 → UTC로 변환해서 DB 저장 시 사용
 */
export function toUTC(date: Date | string, timeZone: string): Date {
  return toZonedTime(date, timeZone); // 로컬시간 → UTC
}

/**
 * UTC 날짜를 유저 타임존으로 변환해서 프론트로 반환할 때 사용
 */
export function fromUTC(utcDate: Date, timeZone: string): Date {
  return toZonedTime(utcDate, timeZone); // UTC → 로컬시간
}

/**
 * get local timezoned date with 00:00
 */
export function getLocalDate(dateStr: string, timeZone: string) {
  const startLocal = startOfDay(new Date(dateStr));
  return toZonedTime(startLocal, timeZone);
}

export function getDateRangeAndLabelByGroup(
  date: Date,
  groupBy: string,
  timezone: string,
) {
  let rangeStart: Date;
  let rangeEnd: Date;
  let label: string;
  const zonedDate = toZonedTime(date, timezone);
  switch (groupBy) {
    case 'daily':
      rangeStart = startOfDay(zonedDate);
      rangeEnd = endOfDay(zonedDate);
      label = format(rangeStart, 'yyyy-MM-dd');
      break;
    case 'weekly':
      rangeStart = startOfWeek(zonedDate, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(zonedDate, { weekStartsOn: 0 });
      label = format(rangeStart, 'yyyy-MM-dd');
      break;
    case 'monthly':
      rangeStart = startOfMonth(zonedDate);
      rangeEnd = endOfMonth(zonedDate);
      label = format(rangeStart, 'yyyy-MM');
      break;
    case 'yearly':
      rangeStart = startOfYear(zonedDate);
      rangeEnd = endOfYear(zonedDate);
      label = format(rangeStart, 'yyyy');
      break;
    default:
      throw new Error('Invalid groupBy');
  }
  return { rangeStart, rangeEnd, label };
}

/**
 * 포맷된 타임존 날짜 (ex. 프론트 테스트 용도)
 */
export function formatZonedDate(
  date: Date,
  timeZone: string,
  fmt = 'yyyy-MM-dd HH:mm:ssXXX',
) {
  return format(fromZonedTime(date, timeZone), fmt, { timeZone });
}

export function getDateRangeList(
  date: Date,
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly',
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
