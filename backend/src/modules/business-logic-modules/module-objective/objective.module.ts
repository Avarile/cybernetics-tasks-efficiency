import { Module } from '@nestjs/common';
import { ObjectiveController } from './objective.controller';
import { ObjectiveRepository } from './objective.repo';
import { ObjectiveService } from './objective.service';

@Module({
  controllers: [ObjectiveController],
  providers: [ObjectiveRepository, ObjectiveService],
  exports: [ObjectiveRepository, ObjectiveService],
})
export class ObjectiveModule {}
