import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { InitiativeRepository } from './initiative.repo';

describe('InitiativeRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: InitiativeRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new InitiativeRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { title: 'Launch MVP', ownerPersonId: 1, priority: 'high' },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Launch MVP');
    expect(created.status).toBe('not_started');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Launch MVP');
    expect(found?.ownerPersonId).toBe(1);
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { title: 'To Be Deleted', ownerPersonId: 1, priority: 'low' },
      ctx,
    );
    await repo.delete(created.id, ctx);
    const found = await repo.findById(created.id, ctx);
    expect(found).toBeNull();
  });

  it('findByOwner returns initiatives for that owner', async () => {
    const ctx = getCtx();
    await repo.create({ title: 'Owner A Initiative', ownerPersonId: 42, priority: 'medium' }, ctx);
    await repo.create({ title: 'Owner B Initiative', ownerPersonId: 99, priority: 'low' }, ctx);

    const results = await repo.findByOwner(42, ctx);
    const titles = results.map((i) => i.title);
    expect(titles).toContain('Owner A Initiative');
    expect(titles).not.toContain('Owner B Initiative');
  });

  it('links and lists key results for an initiative', async () => {
    const ctx = getCtx();
    const i = await repo.create({ title: 'Close Acme', ownerPersonId: 1, priority: 'high' }, ctx);
    await repo.linkKeyResult(i.id, 7, ctx);
    expect(await repo.findKeyResultIds(i.id, ctx)).toContain(7);
  });

  it('linkKeyResult is idempotent — duplicate call does NOT create a second link row', async () => {
    const ctx = getCtx();
    const i = await repo.create({ title: 'Dedup Test', ownerPersonId: 1, priority: 'high' }, ctx);
    await repo.linkKeyResult(i.id, 7, ctx);
    await repo.linkKeyResult(i.id, 7, ctx); // second call — must be silently ignored
    const ids = await repo.findKeyResultIds(i.id, ctx);
    const occurrences = ids.filter((id) => id === 7).length;
    expect(occurrences).toBe(1);
  });

  it('unlinkKeyResult removes the link', async () => {
    const ctx = getCtx();
    const i = await repo.create({ title: 'Unlink Test', ownerPersonId: 1, priority: 'medium' }, ctx);
    await repo.linkKeyResult(i.id, 5, ctx);
    expect(await repo.findKeyResultIds(i.id, ctx)).toContain(5);
    await repo.unlinkKeyResult(i.id, 5, ctx);
    expect(await repo.findKeyResultIds(i.id, ctx)).not.toContain(5);
  });
});
