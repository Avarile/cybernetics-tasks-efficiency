import { Module } from '@nestjs/common';
import { InitiativeModule } from '../module-initiative/initiative.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { TaskModule } from '../module-task/task.module';
import { ActivityEventRepository } from './activity-event.repo';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { TaskStateRepository } from './projection/task-state.repo';
import { TaskStateProjector } from './projection/task-state.projector';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [InitiativeModule, KeyResultModule, TaskModule],
  controllers: [TrackingController],
  providers: [
    ActivityEventRepository,
    InitiativeStateRepository,
    InitiativeStateProjector,
    KeyResultMeasurementRepository,
    TaskStateRepository,
    TaskStateProjector,
    TrackingService,
  ],
  exports: [
    ActivityEventRepository,
    InitiativeStateRepository,
    KeyResultMeasurementRepository,
    TaskStateRepository,
    TaskStateProjector,
    TrackingService,
  ],
})
export class TrackingModule {}
