// 📄 경로: src/libs/date.util.ts
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import {
  formatISO,
  startOfDay,
  endOfDay,
  endOfWeek,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
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
  let rangeStart;
  let rangeEnd;
  let label;
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
