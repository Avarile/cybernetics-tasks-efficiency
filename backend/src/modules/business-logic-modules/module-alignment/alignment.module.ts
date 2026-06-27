import { Module } from '@nestjs/common';
import { ObjectiveModule } from '../module-objective/objective.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { AlignmentController } from './alignment.controller';
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';
import { AlignmentService } from './alignment.service';

@Module({
  imports: [ObjectiveModule, KeyResultModule],
  controllers: [AlignmentController],
  providers: [AlignmentRepository, OkrTreeService, AlignmentService],
  exports: [AlignmentRepository, OkrTreeService, AlignmentService],
})
export class AlignmentModule {}
