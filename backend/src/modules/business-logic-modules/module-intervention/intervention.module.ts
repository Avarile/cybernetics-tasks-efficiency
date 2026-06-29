import { Module } from '@nestjs/common';
import { InterventionController } from './intervention.controller';
import { InterventionRepository } from './intervention.repo';
import { InterventionService } from './intervention.service';
import { KeyResultModule } from '../module-key-result/key-result.module';

@Module({
  imports: [KeyResultModule],
  controllers: [InterventionController],
  providers: [InterventionRepository, InterventionService],
  exports: [InterventionRepository, InterventionService],
})
export class InterventionModule {}
