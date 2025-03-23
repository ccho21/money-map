import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

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
      const token = client.handshake.auth.token;
      console.log('token', token);
      const payload = this.jwt.verify(token);
      const userId = payload.sub;

      client.join(userId); // 👈 userId 방에 조인
      console.log(`✅ User ${userId} connected to socket`);
    } catch (err) {
      console.warn('❌ 소켓 인증 실패', err.message);
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
