import { User } from '@prisma/client';

export const getUserTimezone = (user: User): string =>
  user.timezone || 'America/Toronto';
