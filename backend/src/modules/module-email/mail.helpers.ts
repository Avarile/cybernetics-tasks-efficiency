import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
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
 * No-op transport for when SMTP is not configured. jsonTransport does not send;
 * its default verify() returns false, but @nestjs-modules/mailer calls verify().then()
 * unconditionally, so we patch verify() to resolve.
 */
export function createNoOpTransport(): Transporter {
  const transport = createTransport({ jsonTransport: true });
  const originalVerify = transport.verify.bind(transport);
  transport.verify = function (callback?: (err: Error | null, success: boolean) => void) {
    if (callback) return originalVerify(callback);
    return Promise.resolve(true);
  } as typeof transport.verify;
  return transport;
}

export function hbsHelpers(publicOrigin: string) {
  return {
    publicOrigin: () => publicOrigin,
    currentYear: () => new Date().getFullYear(),
  };
}
