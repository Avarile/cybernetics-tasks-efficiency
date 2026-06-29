import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { BaseProcessor } from 'src/infra/queue/base.processor';
import { QueueName } from 'src/infra/queue/queue.constants';
import { IEmailJob } from './email.interface';

@Processor(QueueName.EMAIL)
export class EmailProcessor extends BaseProcessor {
  constructor(private readonly mailer: MailerService) {
    super();
  }

  async handle(job: Job<IEmailJob>): Promise<void> {
    const { to, subject, context } = job.data;
    // When SMTP is unconfigured the transport is the json no-op, so this logs (BaseProcessor
    // records job:completed) instead of sending. When configured it sends for real.
    this.logger.log({ msg: 'email:sending', to, subject });
    await this.mailer.sendMail({ to, subject, template: 'normal', context });
  }
}
