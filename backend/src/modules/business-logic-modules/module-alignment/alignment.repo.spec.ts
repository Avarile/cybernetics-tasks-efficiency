import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { AlignmentRepository } from './alignment.repo';

describe('AlignmentRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: AlignmentRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new AlignmentRepository(dbProvider);
  });

  it('link → findChildren returns the created row', async () => {
    const ctx = getCtx();
    const created = await repo.link(
      { fromType: 'objective', fromId: 1, toType: 'objective', toId: 2 },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.fromType).toBe('objective');
    expect(created.fromId).toBe(1);
    expect(created.toType).toBe('objective');
    expect(created.toId).toBe(2);

    // findChildren(toType='objective', toId=2) should return the created link
    const children = await repo.findChildren('objective', 2, ctx);
    const ids = children.map((c) => c.id);
    expect(ids).toContain(created.id);
  });

  it('findParents returns rows where fromType/fromId match', async () => {
    const ctx = getCtx();
    const created = await repo.link(
      { fromType: 'objective', fromId: 10, toType: 'objective', toId: 20 },
      ctx,
    );

    const parents = await repo.findParents('objective', 10, ctx);
    const ids = parents.map((p) => p.id);
    expect(ids).toContain(created.id);
  });

  it('unlink soft-deletes the row (hidden from findChildren)', async () => {
    const ctx = getCtx();
    const created = await repo.link(
      { fromType: 'objective', fromId: 5, toType: 'objective', toId: 6 },
      ctx,
    );
    expect(created.id).toBeDefined();

    await repo.unlink(created.id, ctx);

    const children = await repo.findChildren('objective', 6, ctx);
    const ids = children.map((c) => c.id);
    expect(ids).not.toContain(created.id);
  });

  it('link with explicit weight stores the value', async () => {
    const ctx = getCtx();
    const created = await repo.link(
      { fromType: 'key_result', fromId: 3, toType: 'objective', toId: 4, weight: '0.75' },
      ctx,
    );
    expect(created.weight).toBe('0.75');
  });
});
