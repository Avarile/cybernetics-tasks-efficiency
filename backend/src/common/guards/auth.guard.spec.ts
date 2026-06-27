import * as jwt from 'jsonwebtoken';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

jest.mock('src/utils/env', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '1d',
    APP_SALT_ROUNDS: 10,
    ADMIN_ACCOUNT: 'admin@test.com',
    ADMIN_ACCOUNT_PASSWORD: 'admin-pass',
    COMPANY_SCHEMA: 'public',
    DATABASE_MAIN_HOST: 'localhost',
    DATABASE_MAIN_PORT: 5432,
    DATABASE_MAIN_DATABASE: 'test',
    DATABASE_MAIN_USERNAME: 'postgres',
    DATABASE_MAIN_PASSWORD: 'postgres',
  },
}));

function makeContext(authHeader?: string) {
  const req: any = { headers: {} };
  if (authHeader !== undefined) req.headers['authorization'] = authHeader;
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
  return { context, req };
}

function makeReflector(isPublic: boolean): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard(makeReflector(false));
  });

  it('sets req.user and returns true for a valid Bearer token', () => {
    const payload = { id: 1, slug: 'abc', email: 'user@test.com', role: 'member' };
    const token = jwt.sign(payload, 'test-secret-key', { expiresIn: '1h' });
    const { context, req } = makeContext(`Bearer ${token}`);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toMatchObject({ id: 1, email: 'user@test.com', role: 'member' });
  });

  it('throws UNAUTHORIZED when Authorization header is missing', () => {
    const { context } = makeContext();

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('throws UNAUTHORIZED when token is malformed/invalid', () => {
    const { context } = makeContext('Bearer not-a-real-jwt');

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('throws UNAUTHORIZED when token is signed with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret', { expiresIn: '1h' });
    const { context } = makeContext(`Bearer ${token}`);

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('throws UNAUTHORIZED when token is expired', () => {
    const payload = { id: 1, slug: 'abc', email: 'user@test.com', role: 'member' };
    const token = jwt.sign(payload, 'test-secret-key', { expiresIn: '-1s' });
    const { context } = makeContext(`Bearer ${token}`);

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('returns true without checking token when route is marked @Public()', () => {
    const publicGuard = new AuthGuard(makeReflector(true));
    const { context } = makeContext(); // no Authorization header

    expect(publicGuard.canActivate(context)).toBe(true);
  });
});
