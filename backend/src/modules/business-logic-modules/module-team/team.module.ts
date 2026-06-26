import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { TeamController } from './team.controller';
import { TeamRepository } from './team.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [TeamController],
  providers: [TeamRepository],
  exports: [TeamRepository],
})
export class TeamModule {}
