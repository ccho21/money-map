import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/auth/types/user-payload.type';
import { parse } from 'cookie';

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [
        'https://money-map-prod.vercel.app',
        'https://money-app-front-ecru.vercel.app',
      ]
    : ['http://localhost:3000', 'http://localhost:3001'];

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth.token as string | undefined;
      if (!token) {
        const rawCookie = client.handshake.headers?.cookie ?? '';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const cookies = parse(rawCookie) as Record<string, string>;
        token = cookies.access_token;
      }
      if (!token) {
        const auth = client.handshake.headers?.authorization;
        if (auth?.startsWith('Bearer ')) {
          token = auth.replace('Bearer ', '');
        }
      }
      if (!token) throw new Error('jwt must be provided');

      const payload: JwtPayload = this.jwt.verify<JwtPayload>(token);
      const userId: string = payload.sub;

      await client.join(userId); // 🟢 타입 안전
      console.log(`✅ User ${userId} connected to socket`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn('❌ 소켓 인증 실패', err.message);
      } else {
        console.warn('❌ 소켓 인증 실패', JSON.stringify(err));
      }
    }
  }

  emitBudgetAlert(
    userId: string,
    payload: { category: string; message: string },
  ) {
    console.log(`✅ alert is sent to ${userId}`);
    // Frontend clients can listen for this event after establishing a socket
    // connection using the user's access token. The event name is
    // `budget_alert` and the payload contains the category and message.
    this.server.to(userId).emit('budget_alert', payload);
  }
}
