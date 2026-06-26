import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { PersonAccountRepository } from './account.repo';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { AuthGuard } from 'src/middleware/auth.guard';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [ApplicationDbModule],
  controllers: [AuthenticationController],
  providers: [
    PersonAccountRepository,
    AuthenticationService,
    AuthGuard,
    RoleControllerGuard,
    Reflector,
  ],
  exports: [AuthGuard, RoleControllerGuard],
})
export class AuthModule {}
