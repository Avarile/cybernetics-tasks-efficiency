import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '../base.processor';
import { QueueName } from '../queue.constants';

@Processor(QueueName.EXAMPLE)
export class ExampleProcessor extends BaseProcessor {
  async handle(job: Job): Promise<void> {
    this.logger.debug({ msg: 'example:job', name: job.name, data: job.data });
  }
}
