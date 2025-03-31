import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, UserPayload } from '../types/user-payload.type';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');

    super({
      jwtFromRequest: (req: Request): string => {
        const token = req.cookies?.refresh_token as string;
        if (!token) {
          throw new UnauthorizedException('Refresh token not found');
        }

        console.log('✅ Refresh Token in cookie:', token);
        return token;
      },
      secretOrKey: secret, // ✅ 이제 undefined가 아님
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): UserPayload {
    console.log('✅ RefreshTokenStrategy payload.sub:', payload.sub);
    return {
      id: payload.sub,
      email: payload.email,
      timezone: payload.timezone,
    };
  }
}
