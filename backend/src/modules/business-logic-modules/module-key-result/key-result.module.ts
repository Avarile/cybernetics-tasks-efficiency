import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { KeyResultController } from './key-result.controller';
import { KeyResultRepository } from './key-result.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [KeyResultController],
  providers: [KeyResultRepository],
  exports: [KeyResultRepository],
})
export class KeyResultModule {}
