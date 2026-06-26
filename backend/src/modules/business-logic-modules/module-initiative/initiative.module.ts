import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { InitiativeController } from './initiative.controller';
import { InitiativeRepository } from './initiative.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [InitiativeController],
  providers: [InitiativeRepository],
  exports: [InitiativeRepository],
})
export class InitiativeModule {}
