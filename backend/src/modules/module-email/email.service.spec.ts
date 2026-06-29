jest.mock('src/utils/env', () => ({
  default: { MAIL_SENDER_NAME: 'Cybernetic', MAIL_RATE_LIMIT_SECONDS: 60, MAIL_HOST: 'smtp.x', MAIL_AUTH_USER: 'u', MAIL_AUTH_PASS: 'p' },
}));
jest.mock('./mail.helpers', () => ({
  isMailConfigured: jest.fn(),
  buildSmtpOptions: jest.fn(() => ({ host: 'smtp.x' })),
  verifyTransport: jest.fn(),
}));

import { EmailService } from './email.service';
import { isMailConfigured, verifyTransport } from './mail.helpers';
import { SEND_EMAIL_JOB } from 'src/infra/queue/queue.constants';

const CTX = { database_uri: 'u', schema_id: 'public', user_id: 1 } as any;

function make() {
  const queue = { add: jest.fn() } as any;
  const cache = { get: jest.fn(), set: jest.fn() } as any;
  const mailer = { sendMail: jest.fn() } as any;
  return { queue, cache, mailer, svc: new EmailService(queue, cache, mailer) };
}

describe('EmailService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendVerificationCode enqueues a verify-code job after a rate-limit miss', async () => {
    const { svc, queue, cache } = make();
    cache.get.mockResolvedValue(undefined);
    await svc.sendVerificationCode({ to: 'a@b.com', code: '123456', expiresMinutes: 30 }, CTX);
    expect(cache.set).toHaveBeenCalledWith('cyb:public:mail:rate:signup:a@b.com', 1, 60000);
    expect(queue.add).toHaveBeenCalledWith(SEND_EMAIL_JOB, expect.objectContaining({
      to: 'a@b.com',
      subject: 'Verify your email address',
      context: expect.objectContaining({ partialBody: 'verify-code', code: '123456', expiresMinutes: 30, brandName: 'Cybernetic' }),
    }));
  });

  it('rejects with MAIL_RATE_LIMITED and does not enqueue when a key already exists', async () => {
    const { svc, queue, cache } = make();
    cache.get.mockResolvedValue(1);
    await expect(svc.sendPasswordReset({ to: 'a@b.com', resetLink: 'x', expiresMinutes: 15 }, CTX))
      .rejects.toMatchObject({ code: 'MAIL_RATE_LIMITED' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('generic send enqueues without rate limiting', async () => {
    const { svc, queue, cache } = make();
    await svc.send({ to: 'a@b.com', subject: 'Hi', partialBody: 'common-body', context: { title: 'T', message: 'M' } });
    expect(cache.get).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(SEND_EMAIL_JOB, expect.objectContaining({
      subject: 'Hi',
      context: expect.objectContaining({ partialBody: 'common-body', title: 'T', message: 'M', brandName: 'Cybernetic' }),
    }));
  });

  it('sendTestEmail throws MAIL_TRANSPORT_INVALID when not configured', async () => {
    const { svc, mailer } = make();
    (isMailConfigured as jest.Mock).mockReturnValue(false);
    await expect(svc.sendTestEmail('a@b.com')).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('sendTestEmail verifies transport then sends directly when configured', async () => {
    const { svc, mailer } = make();
    (isMailConfigured as jest.Mock).mockReturnValue(true);
    (verifyTransport as jest.Mock).mockResolvedValue(true);
    await svc.sendTestEmail('a@b.com');
    expect(verifyTransport).toHaveBeenCalled();
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com', template: 'normal',
      context: expect.objectContaining({ partialBody: 'common-body' }),
    }));
  });
});
