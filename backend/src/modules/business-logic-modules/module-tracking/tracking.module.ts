import { Module } from '@nestjs/common';
import { InitiativeModule } from '../module-initiative/initiative.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { ActivityEventRepository } from './activity-event.repo';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [InitiativeModule, KeyResultModule],
  controllers: [TrackingController],
  providers: [
    ActivityEventRepository,
    InitiativeStateRepository,
    InitiativeStateProjector,
    KeyResultMeasurementRepository,
    TrackingService,
  ],
  exports: [
    ActivityEventRepository,
    InitiativeStateRepository,
    KeyResultMeasurementRepository,
    TrackingService,
  ],
})
export class TrackingModule {}
