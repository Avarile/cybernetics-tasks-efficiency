// backend/src/infra/queue/schedule/schedule.config.ts
import { QueueName } from '../queue.constants';

export interface ScheduledJob {
  id: string;
  queue: QueueName;
  jobName: string;
  cron: string;
  data?: Record<string, unknown>;
  tz?: string;
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    id: 'example:heartbeat',
    queue: QueueName.EXAMPLE,
    jobName: 'heartbeat',
    cron: '* * * * *',
    data: {},
    tz: 'UTC',
  },
];
