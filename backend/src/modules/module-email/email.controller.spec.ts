import { EmailController } from './email.controller';

describe('EmailController', () => {
  it('test-transport calls sendTestEmail and returns an OK envelope', async () => {
    const emailService = { sendTestEmail: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new EmailController(emailService);
    const res = await controller.testTransport({ to: 'admin@x.com' });
    expect(emailService.sendTestEmail).toHaveBeenCalledWith('admin@x.com');
    expect(res).toMatchObject({ status_code: 200, message: 'Test email sent', error: null });
  });

  it('test-transport propagates a transport error from the service', async () => {
    const emailService = { sendTestEmail: jest.fn().mockRejectedValue({ code: 'MAIL_TRANSPORT_INVALID' }) } as any;
    const controller = new EmailController(emailService);
    await expect(controller.testTransport({ to: 'admin@x.com' })).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
  });
});
