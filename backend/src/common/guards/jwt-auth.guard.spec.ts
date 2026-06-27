jest.mock('src/utils/env', () => ({ default: { JWT_SECRET: 'x' } }));
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function ctx(isPublic: boolean) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const exec = {
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
  return { guard: new JwtAuthGuard(reflector), exec };
}

describe('JwtAuthGuard', () => {
  it('bypasses authentication for @Public() routes', () => {
    const { guard, exec } = ctx(true);
    expect(guard.canActivate(exec)).toBe(true);
  });

  it('throws UNAUTHORIZED in handleRequest when no user is resolved', () => {
    const { guard } = ctx(false);
    expect(() => guard.handleRequest(null, null)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});
