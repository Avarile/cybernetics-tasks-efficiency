import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { ObjectiveController } from './objective.controller';
import { ObjectiveRepository } from './objective.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [ObjectiveController],
  providers: [ObjectiveRepository],
  exports: [ObjectiveRepository],
})
export class ObjectiveModule {}
