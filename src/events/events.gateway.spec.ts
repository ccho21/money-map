import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { Socket } from 'socket.io';

describe('EventsGateway', () => {
  let gateway: EventsGateway;

  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test' })],
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should join room using token from auth', async () => {
    const token = jwtService.sign({
      sub: 'user1',
      email: 'e',
      timezone: 'UTC',
    });
    const joinMock = jest.fn();
    const client = {
      handshake: { auth: { token }, headers: {} },
      join: joinMock,
      disconnect: jest.fn(),
    } as unknown as Socket;

    await gateway.handleConnection(client);
    expect(joinMock).toHaveBeenCalledWith('user1');
  });

  it('should join room using token from cookies', async () => {
    const token = jwtService.sign({
      sub: 'user2',
      email: 'e',
      timezone: 'UTC',
    });
    const joinMock = jest.fn();
    const client = {
      handshake: { auth: {}, headers: { cookie: `access_token=${token}` } },
      join: joinMock,
      disconnect: jest.fn(),
    } as unknown as Socket;

    await gateway.handleConnection(client);
    expect(joinMock).toHaveBeenCalledWith('user2');
  });

  it('should join room using Authorization header', async () => {
    const token = jwtService.sign({
      sub: 'user3',
      email: 'e',
      timezone: 'UTC',
    });
    const joinMock = jest.fn();
    const client = {
      handshake: { auth: {}, headers: { authorization: `Bearer ${token}` } },
      join: joinMock,
      disconnect: jest.fn(),
    } as unknown as Socket;

    await gateway.handleConnection(client);
    expect(joinMock).toHaveBeenCalledWith('user3');
  });
});
