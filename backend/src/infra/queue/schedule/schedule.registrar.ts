// backend/src/infra/queue/schedule/schedule.registrar.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName } from '../queue.constants';
import { SCHEDULED_JOBS, ScheduledJob } from './schedule.config';

@Injectable()
export class ScheduleRegistrar implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleRegistrar.name);

  constructor(
    @InjectQueue(QueueName.EXAMPLE) private readonly exampleQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncSchedulers();
  }

  private queueFor(job: ScheduledJob): Queue {
    // Only queues with scheduled (cron) jobs are registered here. Event-driven
    // queues (e.g. FILE_CROP) are intentionally absent.
    const map: Partial<Record<QueueName, Queue>> = {
      [QueueName.EXAMPLE]: this.exampleQueue,
    };
    const queue = map[job.queue];
    if (!queue) {
      throw new Error(`No queue registered in ScheduleRegistrar for "${job.queue}"`);
    }
    return queue;
  }

  private async syncSchedulers(): Promise<void> {
    for (const job of SCHEDULED_JOBS) {
      const queue = this.queueFor(job);
      await queue.upsertJobScheduler(
        job.id,
        { pattern: job.cron, tz: job.tz },
        { name: job.jobName, data: job.data ?? {} },
      );
      this.logger.log({ msg: 'schedule:upserted', id: job.id, cron: job.cron });
    }

    await this.pruneStaleSchedulers();
  }

  private async pruneStaleSchedulers(): Promise<void> {
    const configIds = new Set(SCHEDULED_JOBS.map((j) => j.id));

    const allQueues = [...new Set(SCHEDULED_JOBS.map((j) => j.queue))];
    for (const queueName of allQueues) {
      const queue = this.queueFor({ queue: queueName } as ScheduledJob);
      const existing = await queue.getJobSchedulers();
      for (const s of existing) {
        if (!configIds.has(s.key)) {
          await queue.removeJobScheduler(s.key);
          this.logger.warn({ msg: 'schedule:pruned', id: s.key });
        }
      }
    }
  }
}
