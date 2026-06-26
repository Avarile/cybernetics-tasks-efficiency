import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { ActivityEventRepository } from './activity-event.repo';

@Module({
  imports: [ApplicationDbModule],
  providers: [ActivityEventRepository],
  exports: [ActivityEventRepository],
})
export class TrackingModule {}
