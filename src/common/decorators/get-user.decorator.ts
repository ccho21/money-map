import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPayload } from 'src/auth/types/user-payload.type';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: UserPayload }>();

    return request.user;
  },
);
