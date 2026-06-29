const mockVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ verify: mockVerify, jsonTransport: true })),
}));

import { createTransport } from 'nodemailer';
import {
  buildEmailFrom, verifyTransport, createNoOpTransport, hbsHelpers,
  isMailConfigured, buildSmtpOptions,
} from './mail.helpers';

describe('mail.helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('buildEmailFrom formats name + address, or bare address', () => {
    expect(buildEmailFrom('a@b.com', 'Cyb')).toBe('Cyb <a@b.com>');
    expect(buildEmailFrom('a@b.com')).toBe('a@b.com');
  });

  it('isMailConfigured requires host, user and pass', () => {
    expect(isMailConfigured('h', 'u', 'p')).toBe(true);
    expect(isMailConfigured('h', undefined, 'p')).toBe(false);
    expect(isMailConfigured(undefined, undefined, undefined)).toBe(false);
  });

  it('buildSmtpOptions maps env to a nodemailer transport config', () => {
    const opts = buildSmtpOptions({
      MAIL_HOST: 'smtp.x', MAIL_PORT: 465, MAIL_SECURE: true,
      MAIL_AUTH_USER: 'u', MAIL_AUTH_PASS: 'p',
      MAIL_CONNECTION_TIMEOUT: 1, MAIL_GREETING_TIMEOUT: 2, MAIL_DNS_TIMEOUT: 3,
    });
    expect(opts).toEqual({
      host: 'smtp.x', port: 465, secure: true,
      auth: { user: 'u', pass: 'p' },
      connectionTimeout: 1, greetingTimeout: 2, dnsTimeout: 3,
    });
  });

  it('verifyTransport resolves when nodemailer verify succeeds', async () => {
    mockVerify.mockResolvedValue(true);
    await expect(verifyTransport({ host: 'h' })).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith({ host: 'h' });
  });

  it('verifyTransport throws MAIL_TRANSPORT_INVALID when verify fails', async () => {
    mockVerify.mockRejectedValue(new Error('ECONN'));
    await expect(verifyTransport({ host: 'h' })).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
  });

  it('createNoOpTransport returns a transport whose verify() resolves', async () => {
    const t = createNoOpTransport();
    await expect((t.verify as () => Promise<boolean>)()).resolves.toBe(true);
  });

  it('hbsHelpers expose publicOrigin and currentYear', () => {
    const h = hbsHelpers('https://app.test');
    expect(h.publicOrigin()).toBe('https://app.test');
    expect(typeof h.currentYear()).toBe('number');
  });
});
