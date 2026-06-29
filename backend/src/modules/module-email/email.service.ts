import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailerService } from '@nestjs-modules/mailer';
import env from 'src/utils/env';
import { QueueName, SEND_EMAIL_JOB } from 'src/infra/queue/queue.constants';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { AppException } from 'src/utils/exception.provider';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { buildSmtpOptions, isMailConfigured, verifyTransport } from './mail.helpers';
import {
  IEmailJob, ISendPayload, IVerificationCodePayload, IPasswordResetPayload, IChangeEmailPayload,
} from './email.interface';

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(QueueName.EMAIL) private readonly queue: Queue<IEmailJob>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly mailer: MailerService,
  ) {}

  private baseContext(): Record<string, unknown> {
    return { brandName: env.MAIL_SENDER_NAME };
  }

  private async enqueue(job: IEmailJob): Promise<void> {
    await this.queue.add(SEND_EMAIL_JOB, job);
  }

  private async rateLimit(schemaId: string, purpose: string, email: string): Promise<void> {
    const key = cacheKey.mailRate(schemaId, purpose, email);
    if (await this.cache.get(key)) {
      AppException.throw('MAIL_RATE_LIMITED', `Too many ${purpose} emails for ${email}`);
    }
    await this.cache.set(key, 1, env.MAIL_RATE_LIMIT_SECONDS * 1000);
  }

  async send(payload: ISendPayload): Promise<void> {
    await this.enqueue({
      to: payload.to,
      subject: payload.subject,
      context: { ...this.baseContext(), partialBody: payload.partialBody, ...(payload.context ?? {}) },
    });
  }

  async sendVerificationCode(p: IVerificationCodePayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'signup', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Verify your email address',
      context: { ...this.baseContext(), partialBody: 'verify-code', code: p.code, expiresMinutes: p.expiresMinutes },
    });
  }

  async sendPasswordReset(p: IPasswordResetPayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'reset', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Reset your password',
      context: { ...this.baseContext(), partialBody: 'reset-password', resetLink: p.resetLink, expiresMinutes: p.expiresMinutes },
    });
  }

  async sendChangeEmailCode(p: IChangeEmailPayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'change-email', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Confirm your new email address',
      context: { ...this.baseContext(), partialBody: 'change-email', code: p.code, expiresMinutes: p.expiresMinutes },
    });
  }

  // The one synchronous send: the admin test endpoint needs immediate verify-and-send feedback.
  async sendTestEmail(to: string): Promise<void> {
    if (!isMailConfigured(env.MAIL_HOST, env.MAIL_AUTH_USER, env.MAIL_AUTH_PASS)) {
      AppException.throw('MAIL_TRANSPORT_INVALID', 'Mail transport is not configured');
    }
    await verifyTransport(buildSmtpOptions(env));
    await this.mailer.sendMail({
      to,
      subject: 'Cybernetic test email',
      template: 'normal',
      context: { ...this.baseContext(), partialBody: 'common-body', title: 'Test email', message: 'Your mail transport is working.' },
    });
  }
}
