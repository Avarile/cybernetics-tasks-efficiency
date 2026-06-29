import { join } from 'path';
import { Logger, Module } from '@nestjs/common';
import type { MailerOptions } from '@nestjs-modules/mailer';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { BullModule } from '@nestjs/bullmq';
import env from 'src/utils/env';
import { QueueName } from 'src/infra/queue/queue.constants';
import {
  buildEmailFrom, hbsHelpers, isMailConfigured, buildSmtpOptions, createNoOpTransport,
} from './mail.helpers';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

export function mailerOptionsFactory(): MailerOptions {
  const configured = isMailConfigured(env.MAIL_HOST, env.MAIL_AUTH_USER, env.MAIL_AUTH_PASS);
  if (!configured) {
    Logger.warn('Mail is not configured — emails will be logged (json transport), not sent.', 'EmailModule');
  }
  return {
    transport: configured ? buildSmtpOptions(env) : createNoOpTransport(),
    defaults: { from: buildEmailFrom(env.MAIL_SENDER, env.MAIL_SENDER_NAME) },
    template: {
      dir: join(__dirname, 'templates', 'pages'),
      adapter: new HandlebarsAdapter(hbsHelpers(env.PUBLIC_ORIGIN)),
      options: { strict: true },
    },
    options: {
      partials: {
        dir: join(__dirname, 'templates', 'partials'),
        options: { strict: true },
      },
    },
  };
}

@Module({
  imports: [
    MailerModule.forRoot(mailerOptionsFactory()),
    BullModule.registerQueue({ name: QueueName.EMAIL }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
