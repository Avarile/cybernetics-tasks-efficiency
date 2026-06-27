import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
