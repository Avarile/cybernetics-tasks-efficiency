import { Module } from '@nestjs/common';
import { InterventionController } from './intervention.controller';
import { InterventionRepository } from './intervention.repo';

@Module({
  controllers: [InterventionController],
  providers: [InterventionRepository],
  exports: [InterventionRepository],
})
export class InterventionModule {}
