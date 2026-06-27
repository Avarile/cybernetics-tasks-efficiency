import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      AppException.throw('UNAUTHORIZED', 'Missing bearer token');
    }
    try {
      req.user = jwt.verify(header.slice(7), env.JWT_SECRET);
      return true;
    } catch {
      AppException.throw('UNAUTHORIZED', 'Invalid token');
    }
  }
}
