import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

import {
  mockSignupDto,
  mockSigninDto,
  mockResponse,
  mockTokens,
} from '@/mocks/auth.mockHelpers';
import { mockPrismaFactory, mockUser } from '@/mocks/mockHelpers';
import { setAuthCookies, clearCookie } from './helpers/cookie.helper';

jest.mock('./helpers/token.helper', () => {
  const { mockTokens } = require('@/tests/mocks/auth.mockHelpers');
  return { generateTokens: jest.fn().mockResolvedValue(mockTokens) };
});

jest.mock('./helpers/cookie.helper', () => ({
  setAuthCookies: jest.fn(),
  clearCookie: jest.fn(),
}));

describe('AuthService (unit)', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let res: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaFactory() },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
    res = mockResponse() as unknown as Response;
    jest.clearAllMocks();
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('throws when email exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.signup(mockSignupDto, res)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('creates a user and sets cookies', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: 'hashed',
      });
      jest.spyOn(bcrypt as any, 'hash').mockResolvedValue('hashed-pass');

      const result = await service.signup(mockSignupDto, res);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: mockSignupDto.email,
          password: 'hashed-pass',
          timezone: mockSignupDto.timezone,
        },
      });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalledWith(
        res,
        mockTokens.accessToken,
        mockTokens.refreshToken,
      );
      expect(result).toEqual({ message: 'Signup successful' });
    });
  });

  describe('signin', () => {
    it('throws when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.signin(mockSigninDto, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws on password mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt as any, 'compare').mockResolvedValue(false);

      await expect(service.signin(mockSigninDto, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('signs in user and sets cookies', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt as any, 'compare').mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser });

      const result = await service.signin(mockSigninDto, res);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Signin successful' });
    });
  });

  describe('googleSignin', () => {
    it('creates new user when not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        hashedRefreshToken: 'hashed',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.googleSignin(mockUser, res);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Google login successful' });
    });

    it('uses existing user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.googleSignin(mockUser, res);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Google login successful' });
    });
  });

  describe('refreshAccessToken', () => {
    it('throws when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.refreshAccessToken(mockUser.id, res),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('issues new tokens and sets cookies', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser });

      const result = await service.refreshAccessToken(mockUser.id, res);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Access token refreshed' });
    });
  });

  describe('signout', () => {
    it('throws when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.signout(mockUser.id, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('clears refresh token and cookies', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser });

      const result = await service.signout(mockUser.id, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { hashedRefreshToken: null },
      });
      expect(clearCookie).toHaveBeenCalledWith(res);
      expect(result).toEqual({ message: 'Signout successful' });
    });
  });
});
