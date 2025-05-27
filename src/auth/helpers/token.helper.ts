// 📄 src/auth/helpers/token.helper.ts
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, UserPayload } from '../types/user-payload.type';
import { ConfigService } from '@nestjs/config';

export const generateTokens = async (
  jwt: JwtService,
  payload: UserPayload,
  config: ConfigService,
) => {
  const jwtPayload: JwtPayload = {
    sub: payload.id, // ✅ 반드시 포함되어야 함
    email: payload.email,
    timezone: payload.timezone,
  };

  const accessToken = await jwt.signAsync(jwtPayload, {
    expiresIn: '15m',
  });

  const refreshSecret = config.get<string>('JWT_REFRESH_SECRET');
  if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET not defined');

  const refreshToken = await jwt.signAsync(jwtPayload, {
    expiresIn: '7d',
    secret: refreshSecret,
  });

  return { accessToken, refreshToken };
};
