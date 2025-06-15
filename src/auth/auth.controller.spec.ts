import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  mockSignupDto,
  mockSigninDto,
  mockResponse,
} from '@/mocks/auth.mockHelpers';
import { mockUserPayload } from '@/mocks/mockHelpers';
import { Response } from 'express';
import { UserPayload } from './types/user-payload.type';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;
  let res: Response;

  beforeEach(async () => {
    service = {
      signup: jest.fn(),
      signin: jest.fn(),
      googleSignin: jest.fn(),
      refreshAccessToken: jest.fn(),
      signout: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = module.get(AuthController);
    res = mockResponse() as unknown as Response;
  });

  it('getMe returns current user', () => {
    const result = controller.getMe(mockUserPayload);
    expect(result).toEqual(mockUserPayload);
  });

  it('signup delegates to service', async () => {
    service.signup.mockResolvedValue({ message: 'ok' });

    const spy = jest.spyOn(service, 'signup');
    const result = await controller.signup(mockSignupDto, res);

    expect(result).toEqual({ message: 'ok' });
    expect(spy).toHaveBeenCalledWith(mockSignupDto, res);
  });

  it('signin delegates to service', async () => {
    service.signin.mockResolvedValue({ message: 'signed' });

    const spy = jest.spyOn(service, 'signin');
    const result = await controller.signin(mockSigninDto, res);

    expect(result).toEqual({ message: 'signed' });
    expect(spy).toHaveBeenCalledWith(mockSigninDto, res);
  });

  it('googleRedirect calls googleSignin', async () => {
    const req = { user: mockUserPayload } as Request & { user: UserPayload };
    service.googleSignin.mockResolvedValue({ message: 'google' });

    const spy = jest.spyOn(service, 'googleSignin');
    const result = await controller.googleRedirect(req, res);

    expect(result).toEqual({ message: 'google' });
    expect(spy).toHaveBeenCalledWith(req.user, res);
  });

  it('refreshAccessToken delegates to service', async () => {
    service.refreshAccessToken.mockResolvedValue({ message: 'refresh' });

    const spy = jest.spyOn(service, 'refreshAccessToken');
    const result = await controller.refreshAccessToken(mockUserPayload, res);

    expect(result).toEqual({ message: 'refresh' });
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, res);
  });

  it('signout delegates to service', async () => {
    service.signout.mockResolvedValue({ message: 'bye' });

    const spy = jest.spyOn(service, 'signout');
    const result = await controller.signout(mockUserPayload, res);

    expect(result).toEqual({ message: 'bye' });
    expect(spy).toHaveBeenCalledWith(mockUserPayload.id, res);
  });
});
