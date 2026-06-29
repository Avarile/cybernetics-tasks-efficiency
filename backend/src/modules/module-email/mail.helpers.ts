import { createTransport } from 'nodemailer';
import type { Transport, SentMessageInfo } from 'nodemailer';
import { AppException } from 'src/utils/exception.provider';

export interface ISmtpEnv {
  MAIL_HOST?: string;
  MAIL_PORT: number;
  MAIL_SECURE: boolean;
  MAIL_AUTH_USER?: string;
  MAIL_AUTH_PASS?: string;
  MAIL_CONNECTION_TIMEOUT: number;
  MAIL_GREETING_TIMEOUT: number;
  MAIL_DNS_TIMEOUT: number;
}

export function buildEmailFrom(sender: string, senderName?: string): string {
  return senderName ? `${senderName} <${sender}>` : sender;
}

export function isMailConfigured(host?: string, user?: string, pass?: string): boolean {
  return Boolean(host && user && pass);
}

export function buildSmtpOptions(e: ISmtpEnv) {
  return {
    host: e.MAIL_HOST,
    port: e.MAIL_PORT,
    secure: e.MAIL_SECURE,
    auth: { user: e.MAIL_AUTH_USER, pass: e.MAIL_AUTH_PASS },
    connectionTimeout: e.MAIL_CONNECTION_TIMEOUT,
    greetingTimeout: e.MAIL_GREETING_TIMEOUT,
    dnsTimeout: e.MAIL_DNS_TIMEOUT,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyTransport(config: any): Promise<true> {
  const transporter = createTransport(config);
  try {
    await transporter.verify();
  } catch (error) {
    AppException.throw(
      'MAIL_TRANSPORT_INVALID',
      `Invalid mail transport: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  return true;
}

/**
 * No-op transport plugin for when SMTP is not configured.
 * Uses jsonTransport semantics (sendMail returns a JSON string with rendered html).
 * Returns a transport plugin object so that MailerTransportFactory wraps it correctly
 * and verify() returns a Promise (required by @nestjs-modules/mailer@1.x).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNoOpTransport(): Transport {
  // Use a real jsonTransport internally for the send path
  const inner = createTransport({ jsonTransport: true });
  return {
    name: 'JSONTransport',
    version: '1.0.0',
    verify(_callback?: (err: Error | null, success: true) => void): Promise<true> {
      return Promise.resolve(true);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(mail: any, callback: (err: Error | null, info: any) => void): void {
      inner.sendMail(mail.data, callback);
    },
  };
}

export function hbsHelpers(publicOrigin: string) {
  return {
    publicOrigin: () => publicOrigin,
    currentYear: () => new Date().getFullYear(),
  };
}
