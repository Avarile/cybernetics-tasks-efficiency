import { Reflector } from '@nestjs/core';
import { RoleControllerGuard } from './role-controller.guard';
import { Role, ROLES_KEY } from './roles.decorator';

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

function makeContext(user?: { role: string }) {
  const req: any = { user };
  const handler = jest.fn();
  const classRef = jest.fn();
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => classRef,
  } as any;
  return { context, handler, classRef };
}

describe('RoleControllerGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RoleControllerGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RoleControllerGuard(reflector);
  });

  it('returns true when no roles are required (public route)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { context } = makeContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when user role matches the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin]);
    const { context } = makeContext({ role: 'admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when user role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin, Role.manager]);
    const { context } = makeContext({ role: 'manager' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws FORBIDDEN when user role does not match any required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin]);
    const { context } = makeContext({ role: 'member' });

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws FORBIDDEN when req.user is absent but roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin]);
    const { context } = makeContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });
});
