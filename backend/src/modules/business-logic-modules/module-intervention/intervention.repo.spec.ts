import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { InterventionRepository } from './intervention.repo';

describe('InterventionRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: InterventionRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new InterventionRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      {
        title: 'Ship new billing flow',
        decidedByPersonId: 1,
        startedAt: new Date().toISOString(),
        scope: 'product',
      },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Ship new billing flow');
    expect(created.status).toBe('planned');
    expect(created.measurementWindowDays).toBe(14);

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Ship new billing flow');
    expect(found?.decidedByPersonId).toBe(1);
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      {
        title: 'To Be Deleted',
        decidedByPersonId: 1,
        startedAt: new Date().toISOString(),
        scope: 'team',
      },
      ctx,
    );
    await repo.delete(created.id, ctx);
    const found = await repo.findById(created.id, ctx);
    expect(found).toBeNull();
  });

  it('update status from planned to active', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      {
        title: 'Status Transition Test',
        decidedByPersonId: 1,
        startedAt: new Date().toISOString(),
        scope: 'org',
      },
      ctx,
    );
    expect(created.status).toBe('planned');

    const updated = await repo.update(created.id, { status: 'active' }, ctx);
    expect(updated.status).toBe('active');
  });

  it('linkKeyResult is idempotent — duplicate call does NOT create a second link row', async () => {
    const ctx = getCtx();
    const i = await repo.create(
      {
        title: 'Dedup Test',
        decidedByPersonId: 1,
        startedAt: new Date().toISOString(),
        scope: 'team',
      },
      ctx,
    );
    await repo.linkKeyResult(i.id, 7, ctx);
    await repo.linkKeyResult(i.id, 7, ctx); // second call — must be silently ignored
    const ids = await repo.findAffectedKeyResultIds(i.id, ctx);
    const occurrences = ids.filter((id) => id === 7).length;
    expect(occurrences).toBe(1);
  });

  it('unlinkKeyResult removes the link', async () => {
    const ctx = getCtx();
    const i = await repo.create(
      {
        title: 'Unlink Test',
        decidedByPersonId: 1,
        startedAt: new Date().toISOString(),
        scope: 'product',
      },
      ctx,
    );
    await repo.linkKeyResult(i.id, 5, ctx);
    expect(await repo.findAffectedKeyResultIds(i.id, ctx)).toContain(5);
    await repo.unlinkKeyResult(i.id, 5, ctx);
    expect(await repo.findAffectedKeyResultIds(i.id, ctx)).not.toContain(5);
  });
});
