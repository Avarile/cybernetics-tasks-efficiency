import { Module } from '@nestjs/common';
import { PersonAccountRepository } from './account.repo';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';

@Module({
  controllers: [AuthenticationController],
  providers: [PersonAccountRepository, AuthenticationService],
})
export class AuthModule {}
