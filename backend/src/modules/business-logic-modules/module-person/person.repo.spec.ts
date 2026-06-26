import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { PersonRepository } from './person.repo';

describe('PersonRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: PersonRepository;

  beforeAll(() => {
    // ApplicationDBProvider uses env vars directly; no NestJS DI needed here
    const dbProvider = new ApplicationDBProvider();
    repo = new PersonRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { name: 'Ada Lovelace', email: 'ada@co.com', role: 'member' },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.email).toBe('ada@co.com');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.email).toBe('ada@co.com');
    expect(found?.name).toBe('Ada Lovelace');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const p = await repo.create(
      { name: 'Bob', email: 'bob@co.com', role: 'member' },
      ctx,
    );
    await repo.delete(p.id, ctx);
    const found = await repo.findById(p.id, ctx);
    expect(found).toBeNull();
  });

  it('findByEmail returns matching person', async () => {
    const ctx = getCtx();
    await repo.create(
      { name: 'Carol', email: 'carol@co.com', role: 'manager' },
      ctx,
    );
    const found = await repo.findByEmail('carol@co.com', ctx);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Carol');
    expect(found?.role).toBe('manager');
  });

  it('query filters by role', async () => {
    const ctx = getCtx();
    await repo.create({ name: 'Dave', email: 'dave@co.com', role: 'admin' }, ctx);
    await repo.create({ name: 'Eve', email: 'eve@co.com', role: 'member' }, ctx);

    const result = await repo.query({ role: 'admin' }, ctx);
    const names = (result.data as any[]).map((p) => p.name);
    expect(names).toContain('Dave');
    // Eve is a member, should not appear
    expect(names).not.toContain('Eve');
  });

  it('query filters by name (ilike)', async () => {
    const ctx = getCtx();
    await repo.create({ name: 'Frank Zappa', email: 'frank@co.com', role: 'member' }, ctx);

    const result = await repo.query({ name: 'frank' }, ctx);
    const names = (result.data as any[]).map((p) => p.name);
    expect(names).toContain('Frank Zappa');
  });

  it('update modifies the person', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { name: 'Grace Hopper', email: 'grace@co.com', role: 'member' },
      ctx,
    );
    const updated = await repo.update(created.id, { role: 'manager' }, ctx);
    expect(updated?.role).toBe('manager');
    // findById should reflect the change
    const found = await repo.findById(created.id, ctx);
    expect(found?.role).toBe('manager');
  });
});
