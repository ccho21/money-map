import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserPayload } from './types/user-payload.type';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { ApiTags } from '@nestjs/swagger';
import { RefreshTokenGuard } from '@/common/guards/refresh-token.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@GetUser() user: UserPayload) {
    return user;
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refreshAccessToken(
    @GetUser() user: UserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log('### user', user.id);
    return this.authService.refreshAccessToken(user.id, res);
  }

  @Post('signup')
  signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.signup(dto, res);
  }

  @Post('signin')
  signin(@Body() dto: SigninDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.signin(dto, res);
  }
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // 자동 리디렉션
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleRedirect(
    @Req() req: Request & { user: UserPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.googleSignin(req.user, res);
  }
}
