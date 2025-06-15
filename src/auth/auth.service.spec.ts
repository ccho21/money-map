import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  mockSignupDto,
  mockSigninDto,
  mockResponse,
  mockTokens,
} from '@/mocks/auth.mockHelpers';
import { mockPrismaFactory, mockUser } from '@/mocks/mockHelpers';
import { setAuthCookies, clearCookie } from './helpers/cookie.helper';

jest.mock('./helpers/token.helper', () => ({
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
}));

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

  it('service defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('throws ConflictException if email exists', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      await expect(service.signup(mockSignupDto, res)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('creates user and stores hashed refresh token', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));

      const createSpy = jest.spyOn(prisma.user, 'create');
      const updateSpy = jest.spyOn(prisma.user, 'update');
      const result = await service.signup(mockSignupDto, res);

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          email: mockSignupDto.email,
          password: 'hashed',
          timezone: mockSignupDto.timezone,
        },
      });
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { hashedRefreshToken: 'hashed' },
      });
      expect(setAuthCookies).toHaveBeenCalledWith(
        res,
        mockTokens.accessToken,
        mockTokens.refreshToken,
      );
      expect(result).toEqual({ message: 'Signup successful' });
    });
  });

  describe('signin', () => {
    it('throws ForbiddenException when user missing', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.signin(mockSigninDto, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException on password mismatch', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare');
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(service.signin(mockSigninDto, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('updates refresh token and sets cookies', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));

      const udpateSpy = jest.spyOn(prisma.user, 'update');
      const result = await service.signin(mockSigninDto, res);

      expect(udpateSpy).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Signin successful' });
    });
  });

  describe('googleSignin', () => {
    it('creates new user when not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));

      const createSpy = jest.spyOn(prisma.user, 'create');
      const updateSpy = jest.spyOn(prisma.user, 'update');
      const result = await service.googleSignin(mockUser, res);

      expect(createSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Google login successful' });
    });

    it('uses existing user when found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));

      const createSpy = jest.spyOn(prisma.user, 'create');
      const updateSpy = jest.spyOn(prisma.user, 'update');

      const result = await service.googleSignin(mockUser, res);

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Google login successful' });
    });
  });

  describe('refreshAccessToken', () => {
    it('throws ForbiddenException when user missing', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.refreshAccessToken(mockUser.id, res),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('issues new tokens and sets cookies', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashed'));

      const updateSpy = jest.spyOn(prisma.user, 'update');
      const result = await service.refreshAccessToken(mockUser.id, res);

      expect(updateSpy).toHaveBeenCalled();
      expect(setAuthCookies).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Access token refreshed' });
    });
  });

  describe('signout', () => {
    it('throws ForbiddenException when user missing', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.signout(mockUser.id, res)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('clears refresh token and cookies', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      const updateSpy = jest.spyOn(prisma.user, 'update');
      const result = await service.signout(mockUser.id, res);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { hashedRefreshToken: null },
      });
      expect(clearCookie).toHaveBeenCalledWith(res);
      expect(result).toEqual({ message: 'Signout successful' });
    });
  });
});
