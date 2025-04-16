
// 📄 Refactored auth.mockHelpers.ts (DTO 중심, 중복 제거)

import { SigninDTO } from '@/auth/dto/signin.dto';
import { SignupDTO } from '@/auth/dto/signup.dto';
import { Response } from 'express';

// ✅ Signup용 DTO mock
export const mockSignupDto: SignupDTO = {
  email: 'test@example.com',
  password: 'securePassword123!',
  timezone: 'Asia/Seoul',
};

// ✅ Signin용 DTO mock
export const mockSigninDto: SigninDTO = {
  email: 'test@example.com',
  password: 'securePassword123!',
};

// ✅ mock 응답 객체
export const mockResponse = (): Response => {
  const res: Partial<Response> = {
    cookie: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

// ✅ mock 토큰 데이터
export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};
