import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, UserPayload } from '../types/user-payload.type';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService, // ✅ 유저 확인용 의존성 주입
  ) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET not defined');

    super({
      jwtFromRequest: (req: Request): string => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const token = req.cookies?.refresh_token as string;
        if (!token) {
          throw new UnauthorizedException('Refresh token not found');
        }

        return token;
      },
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<UserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, timezone: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
    };
  }
}
