import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { InitiativeModule } from '../module-initiative/initiative.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { ActivityEventRepository } from './activity-event.repo';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [ApplicationDbModule, AuthModule, InitiativeModule, KeyResultModule],
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
