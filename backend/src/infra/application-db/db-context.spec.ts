import { DbContextService } from './db-context';
import env from 'src/utils/env';

describe('DbContextService', () => {
  it('builds single-tenant context from env', () => {
    const svc = new DbContextService();
    const ctx = svc.forUser(42);
    expect(ctx.schema_id).toBe(env.COMPANY_SCHEMA); // env-relative, not a hardcoded literal
    expect(ctx.user_id).toBe(42);
    expect(ctx.database_uri).toContain('postgresql://');
  });
});
