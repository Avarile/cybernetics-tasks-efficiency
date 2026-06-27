import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IUserSession =>
    ctx.switchToHttp().getRequest().user,
);
