import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class LocalAuthGuard extends PassportAuthGuard('local') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    }
    return user as TUser;
  }
}
