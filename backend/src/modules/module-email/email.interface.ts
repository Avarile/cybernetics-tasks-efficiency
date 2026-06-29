// The BullMQ job payload. Every email renders the `normal` page; `context.partialBody`
// selects the body partial. The processor sets `template: 'normal'` itself.
export interface IEmailJob {
  to: string;
  subject: string;
  context: Record<string, unknown>;
}

export interface ISendPayload {
  to: string;
  subject: string;
  partialBody: string;
  context?: Record<string, unknown>;
}

export interface IVerificationCodePayload {
  to: string;
  code: string;
  expiresMinutes: number;
}

export interface IPasswordResetPayload {
  to: string;
  resetLink: string;
  expiresMinutes: number;
}

export interface IChangeEmailPayload {
  to: string;
  code: string;
  expiresMinutes: number;
}
