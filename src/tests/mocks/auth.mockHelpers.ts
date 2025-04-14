// 📄 src/tests/mocks/auth.mockHelpers.ts

import { SigninDto } from '@/auth/dto/signin.dto';
import { SignupDto } from '@/auth/dto/signup.dto';
import { User } from '@prisma/client';
import { Response } from 'express';

export const mockSignupDto: SignupDto = {
  email: 'test@example.com',
  password: 'securePassword123!',
  timezone: 'Asia/Seoul',
};

export const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed-password',
  timezone: 'Asia/Seoul',
  createdAt: new Date(),
  hashedRefreshToken: null,
};

export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

export const mockResponse = (): Response => {
  const res: Partial<Response> = {
    cookie: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

export const mockSigninDto: SigninDto = {
  email: 'test@example.com',
  password: 'securePassword123!',
};
