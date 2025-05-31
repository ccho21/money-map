import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserPayload } from '../types/user-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req.cookies.access_token,
      ]),
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): UserPayload {
    return {
      id: payload.sub,
      email: payload.email,
      timezone: payload.timezone,
    };
  }
}
