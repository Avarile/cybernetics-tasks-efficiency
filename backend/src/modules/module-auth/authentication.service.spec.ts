jest.mock('src/utils/env', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    REFRESH_COOKIE_NAME: 'cyb_refresh',
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: undefined,
    APP_SALT_ROUNDS: 10,
  },
}));

import { AuthenticationService } from './authentication.service';

const SYS = { database_uri: 'u', schema_id: 'public', user_id: 0 };

function deps() {
  const accounts = { findByEmail: jest.fn(), findById: jest.fn(), createPerson: jest.fn() } as any;
  const sessions = { create: jest.fn(), findActiveByHash: jest.fn(), revoke: jest.fn() } as any;
  const passwords = { compare: jest.fn(), hash: jest.fn() } as any;
  const tokens = {
    signAccessToken: jest.fn().mockReturnValue('access.jwt'),
    generateRefreshToken: jest.fn().mockReturnValue({ raw: 'raw-refresh', hash: 'hash-refresh' }),
    hashRefresh: jest.fn((r: string) => `hash-${r}`),
    refreshExpiryIso: jest.fn().mockReturnValue(new Date(Date.now() + 1000).toISOString()),
    refreshTtlMs: jest.fn().mockReturnValue(1000),
  } as any;
  const ctx = { system: jest.fn().mockReturnValue(SYS), forUser: jest.fn() } as any;
  return { accounts, sessions, passwords, tokens, ctx };
}

const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() } as any);
const req = (cookies: any = {}) => ({ headers: {}, ip: '127.0.0.1', cookies } as any);

describe('AuthenticationService', () => {
  it('validateCredentials returns a session on correct password', async () => {
    const d = deps();
    d.accounts.findByEmail.mockResolvedValue({ id: 3, slug: 's', email: 'u@x.com', role: 'member', passwordHash: 'h' });
    d.passwords.compare.mockResolvedValue(true);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.validateCredentials('u@x.com', 'pw')).resolves.toMatchObject({ id: 3, role: 'member' });
  });

  it('validateCredentials throws UNAUTHORIZED on wrong password', async () => {
    const d = deps();
    d.accounts.findByEmail.mockResolvedValue({ id: 3, passwordHash: 'h', role: 'member' });
    d.passwords.compare.mockResolvedValue(false);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.validateCredentials('u@x.com', 'bad')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('login signs an access token and persists a refresh session + cookie', async () => {
    const d = deps();
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const r = res();
    const out = await svc.login({ id: 1, slug: 's', email: 'u@x.com', role: 'member' } as any, req(), r);
    expect(out.accessToken).toBe('access.jwt');
    expect(d.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 1, refreshTokenHash: 'hash-refresh' }),
      SYS,
    );
    expect(r.cookie).toHaveBeenCalledWith('cyb_refresh', 'raw-refresh', expect.objectContaining({ httpOnly: true }));
  });

  it('refresh rotates: revokes the old session and issues a new pair', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue({ id: 99, personId: 1 });
    d.accounts.findById.mockResolvedValue({ id: 1, slug: 's', email: 'u@x.com', role: 'member', isActive: true, isDeleted: false });
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const out = await svc.refresh(req({ cyb_refresh: 'raw-refresh' }), res());
    expect(d.sessions.revoke).toHaveBeenCalledWith(99, SYS);
    expect(d.sessions.create).toHaveBeenCalled();
    expect(out.accessToken).toBe('access.jwt');
  });

  it('refresh throws UNAUTHORIZED when no active session matches', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue(null);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.refresh(req({ cyb_refresh: 'x' }), res())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('logout revokes the matching session and clears the cookie', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue({ id: 99, personId: 1 });
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const r = res();
    await svc.logout(req({ cyb_refresh: 'raw-refresh' }), r);
    expect(d.sessions.revoke).toHaveBeenCalledWith(99, SYS);
    expect(r.clearCookie).toHaveBeenCalledWith('cyb_refresh', expect.objectContaining({ path: '/api/auth' }));
  });
});
