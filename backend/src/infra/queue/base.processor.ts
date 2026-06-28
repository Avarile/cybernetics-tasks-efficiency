import { Logger } from '@nestjs/common';
import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  async process(job: Job): Promise<unknown> {
    const start = Date.now();
    const ctx = {
      queue: job.queueName,
      jobId: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
    };
    try {
      const result = await this.handle(job);
      this.logger.log({ msg: 'job:completed', ...ctx, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      this.logger.error({
        msg: 'job:failed',
        ...ctx,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug({ msg: 'worker:completed', jobId: job.id });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error({ msg: 'worker:failed', jobId: job?.id, error: err instanceof Error ? err.message : String(err) });
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn({ msg: 'worker:stalled', jobId });
  }

  abstract handle(job: Job): Promise<unknown>;
}
