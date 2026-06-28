import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import env from 'src/utils/env';
import { DEFAULT_JOB_OPTIONS, QueueName } from './queue.constants';
import { ExampleProcessor } from './example/example.processor';
import { InfraScheduleModule } from './schedule/schedule.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD,
          db: env.REDIS_BULLMQ_DB,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue({ name: QueueName.EXAMPLE }),
    InfraScheduleModule,
  ],
  providers: [ExampleProcessor],
  exports: [BullModule],
})
export class QueueModule {}
