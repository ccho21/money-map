import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

import {
  mockSignupDto,
  mockUser,
  mockResponse,
  mockSigninDto,
} from '@/tests/mocks/auth.mockHelpers';
import { AuthService } from './auth.service';
import { generateTokens } from './helpers/token.helper';
import { setAuthCookies } from './helpers/set-cookie.helper';

// helper 함수 mocking
jest.mock('./helpers/token.helper', () => ({
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
}));

jest.mock('./helpers/set-cookie.helper', () => ({
  setAuthCookies: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let res: Response;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    res = mockResponse() as unknown as Response;
  });

  describe('signup', () => {
    it('should throw ConflictException if email already exists', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      await expect(service.signup(mockSignupDto, res)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should signup user and return success message', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(prisma.user, 'create')
        .mockResolvedValue(mockUser);
      const updateSpy = jest.spyOn(prisma.user, 'update').mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: 'hashed-refresh',
      });

      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => void Promise.resolve('hashed-password'));

      const result = await service.signup(mockSignupDto, res);

      expect(createSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(generateTokens).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Signup successful' });
    });
  });

  describe('signin', () => {
    it('should throw ForbiddenException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.signin(mockSigninDto, res)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if password mismatch', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => false);

      await expect(service.signin(mockSigninDto, res)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should signin successfully and return message', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => true);
      const updateSpy = jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue({ ...mockUser, hashedRefreshToken: 'hashed' });
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => void Promise.resolve('hashed-refresh-token'));

      const result = await service.signin(mockSigninDto, res);

      expect(updateSpy).toHaveBeenCalled();
      expect(generateTokens).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Signin successful' });
    });
  });
});
