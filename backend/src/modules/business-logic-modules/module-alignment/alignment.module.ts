import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { ObjectiveModule } from '../module-objective/objective.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { AlignmentController } from './alignment.controller';
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';

@Module({
  imports: [ApplicationDbModule, AuthModule, ObjectiveModule, KeyResultModule],
  controllers: [AlignmentController],
  providers: [AlignmentRepository, OkrTreeService],
  exports: [AlignmentRepository, OkrTreeService],
})
export class AlignmentModule {}
