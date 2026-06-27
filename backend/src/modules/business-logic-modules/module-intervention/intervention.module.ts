import { Module } from '@nestjs/common';
import { InterventionController } from './intervention.controller';
import { InterventionRepository } from './intervention.repo';
import { InterventionService } from './intervention.service';

@Module({
  controllers: [InterventionController],
  providers: [InterventionRepository, InterventionService],
  exports: [InterventionRepository, InterventionService],
})
export class InterventionModule {}
