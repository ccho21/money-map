// src/modules/shared/lib/dates/resolveDateRange.ts

import { BadRequestException } from '@nestjs/common';
import { getUserTimezone } from './timezone';
import { getUTCEndDate, getUTCStartDate } from './date.util';
import { User } from '@prisma/client';

interface ResolveDateRangeOptions {
  user: User;
  startDate?: string;
  endDate?: string;
  timeframe?: string;
}

export function resolveDateRange({
  user,
  startDate,
  endDate,
  timeframe,
}: ResolveDateRangeOptions): { start: Date | null; end: Date | null; timezone: string } {
  const timezone = getUserTimezone(user);

  if (timeframe === 'all') {
    return { start: null, end: null, timezone };
  }

  if (!startDate || !endDate) {
    throw new BadRequestException('timeframe이 "all"이 아닌 경우 startDate와 endDate는 필수입니다.');
  }

  const start = getUTCStartDate(startDate, timezone);
  const end = getUTCEndDate(endDate, timezone);
  return { start, end, timezone };
}
