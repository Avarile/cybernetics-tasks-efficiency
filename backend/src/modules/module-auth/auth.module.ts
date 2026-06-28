import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import env from 'src/utils/env';
import { PersonAccountRepository } from './account.repo';
import { AuthSessionRepository } from './auth-session.repo';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL },
    }),
  ],
  controllers: [AuthenticationController],
  providers: [
    PersonAccountRepository,
    AuthSessionRepository,
    AuthenticationService,
    PasswordService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [PasswordService],
})
export class AuthModule {}
