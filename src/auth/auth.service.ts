import { Injectable, Logger, ConflictException, ForbiddenException, Res } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from './types/user-payload.type';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
        timezone: dto.timezone || 'UTC', // 기본값 'UTC'를 설정
      },
    });

    const payload = { id: user.id, email: user.email, timezone: user.timezone };
    const token = await this.jwt.signAsync(payload);

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    });

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

    const payload = { id: user.id, email: user.email, timezone: user.timezone };
    const token = await this.jwt.signAsync(payload);

    // ✅ access_token 쿠키로 설정
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    });

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

    if (!existingUser) {
      this.logger.log(`🆕 Creating new Google user: ${user.email}`);
      existingUser = await this.prisma.user.create({
        data: {
          email: user.email,
          password: '', // 소셜 로그인 사용자는 비밀번호 없음
          timezone: user.timezone || 'UTC', // 기본값 'UTC'를 설정
        },
      });
    } else {
      this.logger.log(`📌 Existing Google user found: ${user.email}`);
    }

    const payload = { id: user.id, email: user.email, timezone: user.timezone };
    const token = await this.jwt.signAsync(payload);

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    });

    this.logger.log(`✅ Google login successful: ${user.email}`);

    return {
      message: 'Google login successful',
    };
  }
}
