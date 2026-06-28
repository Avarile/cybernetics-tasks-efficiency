// backend/src/infra/health/health.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../queue/queue.constants';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.EXAMPLE })],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class HealthModule {}
