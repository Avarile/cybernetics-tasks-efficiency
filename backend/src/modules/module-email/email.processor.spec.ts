import { EmailProcessor } from './email.processor';
import { Job } from 'bullmq';

function job(data: any): Job {
  return { data, queueName: 'email', id: '1', name: 'send_email', attemptsMade: 0 } as unknown as Job;
}

describe('EmailProcessor', () => {
  it('handle sends via MailerService using the normal page + job context', async () => {
    const mailer = { sendMail: jest.fn().mockResolvedValue({}) } as any;
    const proc = new EmailProcessor(mailer);
    await proc.handle(job({ to: 'a@b.com', subject: 'Hi', context: { partialBody: 'verify-code', code: '1' } }));
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'a@b.com',
      subject: 'Hi',
      template: 'normal',
      context: { partialBody: 'verify-code', code: '1' },
    });
  });

  it('handle propagates send errors so BullMQ retries', async () => {
    const mailer = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) } as any;
    const proc = new EmailProcessor(mailer);
    await expect(proc.handle(job({ to: 'a@b.com', subject: 'Hi', context: {} }))).rejects.toThrow('smtp down');
  });
});
