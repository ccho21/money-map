// 📄 src/auth/guards/refresh-token.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {} // ✅ strategy name 반드시 동일해야 함
