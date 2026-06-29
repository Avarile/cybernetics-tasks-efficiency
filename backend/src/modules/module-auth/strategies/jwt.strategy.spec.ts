jest.mock('src/utils/env', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
    COMPANY_SCHEMA: 'public',
  },
}));

import { JwtStrategy } from './jwt.strategy';
import { cacheKey, CACHE_TTL_SHORT } from 'src/infra/cache/cache.constants';
import { BusinessException } from 'src/utils/exception.provider';

const PAYLOAD = { id: 7, slug: 's', email: 'a@b.c', role: 'member' as const };

function makePerson(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    slug: 's',
    email: 'a@b.c',
    name: 'A',
    passwordHash: null,
    role: 'member',
    departmentId: null,
    teamId: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    isDeleted: false,
    isActive: true,
    ...over,
  };
}

function setup() {
  const accounts = { findById: jest.fn() } as any;
  const ctx = { system: jest.fn().mockReturnValue({ schema_id: 'public', user_id: 0, database_uri: 'u' }) } as any;
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as any;
  const strategy = new JwtStrategy(accounts, ctx, cache);
  return { strategy, accounts, cache };
}

describe('JwtStrategy.validate (cache-aside)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('on cache MISS: loads from repo and populates the schema-scoped key', async () => {
    const { strategy, accounts, cache } = setup();
    cache.get.mockResolvedValue(undefined);
    accounts.findById.mockResolvedValue(makePerson());

    const session = await strategy.validate(PAYLOAD);

    const key = cacheKey.account('public', 7);
    expect(cache.get).toHaveBeenCalledWith(key);
    expect(accounts.findById).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(key, expect.objectContaining({ id: 7 }), CACHE_TTL_SHORT);
    expect(session).toMatchObject({ id: 7, role: 'member' });
  });

  it('on cache HIT: does NOT touch the repo', async () => {
    const { strategy, accounts, cache } = setup();
    cache.get.mockResolvedValue(makePerson());

    await strategy.validate(PAYLOAD);

    expect(accounts.findById).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('rejects a cached-but-deactivated account', async () => {
    const { strategy, cache } = setup();
    cache.get.mockResolvedValue(makePerson({ isActive: false }));

    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(BusinessException);
  });

  it('does NOT cache a missing account', async () => {
    const { strategy, accounts, cache } = setup();
    cache.get.mockResolvedValue(undefined);
    accounts.findById.mockResolvedValue(null);

    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(BusinessException);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
