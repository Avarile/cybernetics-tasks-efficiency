import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { ActivityEventRepository } from './activity-event.repo';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';

@Module({
  imports: [ApplicationDbModule],
  providers: [
    ActivityEventRepository,
    InitiativeStateRepository,
    InitiativeStateProjector,
  ],
  exports: [ActivityEventRepository, InitiativeStateRepository],
})
export class TrackingModule {}
