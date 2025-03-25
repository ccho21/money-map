import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserPayload } from 'src/auth/types/user-payload.type';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token: string = client.handshake.auth.token as string;
      const payload: UserPayload = this.jwt.verify<UserPayload>(token);
      const userId: string = payload.id;

      await client.join(userId); // 🟢 타입 안전
      console.log(`✅ User ${userId} connected to socket`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn('❌ 소켓 인증 실패', err.message);
      } else {
        console.warn('❌ 소켓 인증 실패: Unknown error');
      }
      client.disconnect();
    }
  }

  emitBudgetAlert(
    userId: string,
    payload: { category: string; message: string },
  ) {
    console.log(`✅ alert is sent to ${userId}`);
    this.server.to(userId).emit('budget_alert', payload);
  }
}
