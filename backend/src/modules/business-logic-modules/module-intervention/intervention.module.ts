import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { InterventionController } from './intervention.controller';
import { InterventionRepository } from './intervention.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [InterventionController],
  providers: [InterventionRepository],
  exports: [InterventionRepository],
})
export class InterventionModule {}
