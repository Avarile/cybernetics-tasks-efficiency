import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthenticationService } from '../authentication.service';
import { IUserSession } from '../current-user-module/session.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthenticationService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  validate(email: string, password: string): Promise<IUserSession> {
    return this.authService.validateCredentials(email, password);
  }
}
