import { Test } from '@nestjs/testing';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { mailerOptionsFactory } from './email.module';

// No SMTP env in tests → mailerOptionsFactory uses the json no-op transport,
// so sendMail renders the template and returns it as a JSON string without sending.
describe('email templates (no-op render)', () => {
  let mailer: MailerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MailerModule.forRoot(mailerOptionsFactory())],
    }).compile();
    mailer = moduleRef.get(MailerService);
  });

  it('renders the verify-code body with the code and brand', async () => {
    const info = (await mailer.sendMail({
      to: 'user@example.com',
      subject: 'Verify your email address',
      template: 'normal',
      context: { brandName: 'Cybernetic', partialBody: 'verify-code', code: '123456', expiresMinutes: 30 },
    })) as { message: string };
    const rendered = JSON.parse(info.message);
    expect(rendered.html).toContain('123456');
    expect(rendered.html).toContain('Cybernetic');
    expect(rendered.html).toContain('expires in 30 minutes');
  });

  it('renders the reset-password body with the link', async () => {
    const info = (await mailer.sendMail({
      to: 'user@example.com',
      subject: 'Reset your password',
      template: 'normal',
      context: { brandName: 'Cybernetic', partialBody: 'reset-password', resetLink: 'https://app.test/r/abc', expiresMinutes: 15 },
    })) as { message: string };
    const rendered = JSON.parse(info.message);
    expect(rendered.html).toContain('https://app.test/r/abc');
  });
});
