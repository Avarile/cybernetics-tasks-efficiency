// backend/src/infra/queue/schedule/schedule.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../queue.constants';
import { ScheduleRegistrar } from './schedule.registrar';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.EXAMPLE })],
  providers: [ScheduleRegistrar],
})
export class InfraScheduleModule {}
