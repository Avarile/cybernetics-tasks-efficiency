import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';
import { authSession } from './auth.schema';

describe('auth_session schema', () => {
  it('maps to the auth_session table with the expected columns', () => {
    const cfg = getTableConfig(authSession);
    expect(cfg.name).toBe('auth_session');
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toEqual(
      expect.arrayContaining([
        'person_id',
        'refresh_token_hash',
        'user_agent',
        'ip_address',
        'expires_at',
        'revoked_at',
        'id',
        'slug',
      ]),
    );
  });

  it('camelCase TS keys include personId, refreshTokenHash, expiresAt, revokedAt', () => {
    const cols = Object.keys(getTableColumns(authSession));
    expect(cols).toEqual(
      expect.arrayContaining([
        'personId',
        'refreshTokenHash',
        'userAgent',
        'ipAddress',
        'expiresAt',
        'revokedAt',
        'id',
        'slug',
        'isDeleted',
        'isActive',
      ]),
    );
  });

  it('declares a unique index on refresh_token_hash', () => {
    const cfg = getTableConfig(authSession);
    const uniqueIdx = cfg.indexes.find((i) => i.config.unique);
    expect(uniqueIdx).toBeDefined();
    const colNames = uniqueIdx?.config.columns.map((c: any) => c.name);
    expect(colNames).toContain('refresh_token_hash');
  });
});
