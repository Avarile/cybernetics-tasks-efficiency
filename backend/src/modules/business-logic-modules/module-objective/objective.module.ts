import { Module } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { ObjectiveRepository } from './objective.repo';

@Module({
  controllers: [ObjectiveController],
  providers: [ObjectiveRepository],
  exports: [ObjectiveRepository],
})
export class ObjectiveModule {}
