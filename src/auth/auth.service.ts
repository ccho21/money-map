import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from './types/user-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    this.logger.debug(`📥 Signup attempt: ${dto.email}`);

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      this.logger.warn(`❌ Email already exists: ${dto.email}`);
      throw new ForbiddenException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
      },
    });

    this.logger.log(`✅ Signup success: ${dto.email}`);
    return { message: 'Signup success' };
  }

  async signin(dto: SigninDto) {
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

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwt.signAsync(payload);
    this.logger.log(`✅ Signin success: ${dto.email}`);

    return { access_token: token };
  }

  async googleSignin(user: UserPayload) {
    this.logger.debug(`🔓 Google Signin: ${user.email}`);

    let existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      this.logger.log(`🆕 Creating new Google user: ${user.email}`);
      existingUser = await this.prisma.user.create({
        data: {
          email: user.email,
          password: '',
        },
      });
    } else {
      this.logger.log(`📌 Existing Google user found: ${user.email}`);
    }

    const payload = { sub: existingUser.id, email: existingUser.email };
    const token = await this.jwt.signAsync(payload);

    this.logger.log(`✅ Google login successful: ${user.email}`);
    return {
      message: 'Google login successful',
      access_token: token,
    };
  }
}
