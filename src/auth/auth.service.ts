import { ForbiddenException, Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from './types/user-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ForbiddenException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
      },
    });

    return { message: 'Signup success' };
  }

  async signin(dto: SigninDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new ForbiddenException('Invalid credentials');

    const pwMatches = await bcrypt.compare(dto.password, user.password);
    if (!pwMatches) throw new ForbiddenException('Invalid credentials');

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwt.signAsync(payload);
    return { access_token: token };
  }

  async googleSignin(user: UserPayload) {
    let existingUser = await this.prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      existingUser = await this.prisma.user.create({
        data: {
          email: user.email,
          password: '', // 소셜 로그인은 비밀번호 없음
        },
      });
    }

    const payload = { sub: existingUser.id, email: existingUser.email };
    const token = await this.jwt.signAsync(payload);

    return {
      message: 'Google login successful',
      access_token: token,
    };
  }
}
