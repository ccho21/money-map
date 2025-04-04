import {
  Injectable,
  Logger,
  ConflictException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from './types/user-payload.type';
import { Response } from 'express';
import { getUserTimezone } from '@/libs/timezone';
import { setAuthCookies } from './helpers/set-cookie.helper';
import { generateTokens } from './helpers/token.helper';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    this.logger.debug(`📥 Signup attempt: ${dto.email}`);

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`❌ Email already exists: ${dto.email}`);
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        timezone: dto.timezone || 'UTC',
      },
    });

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
    };

    const { accessToken, refreshToken } = await generateTokens(
      this.jwt,
      payload,
      this.configService,
    );

    // ✅ refresh_token 해싱 후 저장
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    // ✅ 쿠키로 전송
    setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`✅ Signup success (auto-signin): ${dto.email}`);
    return { message: 'Signup successful' };
  }

  async signin(dto: SigninDto, @Res({ passthrough: true }) res: Response) {
    this.logger.debug(`🔐 Signin attempt: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`❌ User not found: ${dto.email}`);
      throw new ForbiddenException('Invalid credentials');
    }

    const pwMatches = await bcrypt.compare(dto.password, user.password);
    if (!pwMatches) {
      this.logger.warn(`❌ Password mismatch: ${dto.email}`);
      throw new ForbiddenException('Invalid credentials');
    }

    // ✅ 토큰 생성
    const payload = {
      id: user.id,
      email: user.email,
      timezone: user.timezone,
    };

    const { accessToken, refreshToken } = await generateTokens(
      this.jwt,
      payload,
      this.configService,
    );

    // ✅ refresh_token 해싱 후 저장
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    // ✅ 쿠키 설정
    setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`✅ Signin success: ${dto.email}`);
    return { message: 'Signin successful' };
  }

  async googleSignin(
    user: UserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`🔓 Google Signin: ${user.email}`);

    let existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    // ✅ 사용자 없으면 새로 생성
    if (!existingUser) {
      this.logger.log(`🆕 Creating new Google user: ${user.email}`);
      existingUser = await this.prisma.user.create({
        data: {
          email: user.email,
          password: '', // 소셜 로그인 사용자는 비밀번호 없음
          timezone: user.timezone || 'UTC',
        },
      });
    } else {
      this.logger.log(`📌 Existing Google user found: ${user.email}`);
    }

    const payload = {
      id: existingUser.id,
      email: existingUser.email,
      timezone: existingUser.timezone,
    };

    const { accessToken, refreshToken } = await generateTokens(
      this.jwt,
      payload,
      this.configService,
    );

    // ✅ refresh_token 해싱 후 DB에 저장
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { hashedRefreshToken },
    });

    // ✅ 쿠키 설정
    setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`✅ Google login successful: ${user.email}`);

    return {
      message: 'Google login successful',
    };
  }

  async refreshAccessToken(
    userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`🔄 Refresh token 요청: userId=${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) {
      this.logger.warn(`❌ 존재하지 않는 유저입니다: ${userId}`);
      throw new ForbiddenException('유효하지 않은 사용자입니다');
    }
    const timezone = getUserTimezone(user);
    const payload = {
      id: user.id,
      email: user.email,
      timezone: user.timezone || timezone,
    };
    // ✅ 새로운 access / refresh token 생성
    const { accessToken, refreshToken } = await generateTokens(
      this.jwt,
      payload,
      this.configService,
    );

    // ✅ refresh token 저장 (hash 처리 후 DB 저장)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    // ✅ 쿠키로 전송
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 15, // 15분
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    });

    this.logger.log(`✅ access_token 재발급 완료: ${user.email}`);

    return { message: 'Access token refreshed' };
  }
}
