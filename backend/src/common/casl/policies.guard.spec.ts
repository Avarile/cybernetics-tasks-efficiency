import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory } from './ability.factory';

jest.mock('src/utils/env', () => ({ default: { JWT_SECRET: 'x' } }));

function ctxFor(user: any) {
  const req: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PoliciesGuard', () => {
  const factory = new CaslAbilityFactory();
  let reflector: jest.Mocked<Reflector>;
  let guard: PoliciesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PoliciesGuard(reflector, factory);
  });

  it('allows routes with no @CheckPolicies metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toBe(true);
  });

  it('allows when every policy handler passes', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('read', 'Objective')]);
    expect(guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toBe(true);
  });

  it('throws FORBIDDEN when a policy handler fails', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('create', 'Objective')]);
    expect(() => guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws UNAUTHORIZED when policies are required but req.user is absent', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('read', 'Objective')]);
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});
