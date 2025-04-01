import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parse,
  startOfDay,
} from 'date-fns';

export function parseLocalDateRange(dateStr: string, range: string) {
  let date: Date;
  if (range === 'Monthly') {
    date = parse(dateStr, 'yyyy-MM', new Date());
    return {
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    };
  }

  if (range === 'Yearly') {
    date = parse(dateStr, 'yyyy', new Date());
    return {
      startDate: startOfYear(date),
      endDate: endOfYear(date),
    };
  }

  throw new Error(`Unsupported range: ${range}`);
}
