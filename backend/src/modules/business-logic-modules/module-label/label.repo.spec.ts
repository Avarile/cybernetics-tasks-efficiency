import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { LabelRepository } from './label.repo';

describe('LabelRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: LabelRepository;

  beforeAll(() => {
    repo = new LabelRepository(new ApplicationDBProvider());
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'bug', color: '#ff0000' }, ctx);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('bug');
    const found = await repo.findById(created.id, ctx);
    expect(found?.name).toBe('bug');
  });

  it('delete soft-deletes (hidden from findById)', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'temp' }, ctx);
    await repo.delete(created.id, ctx);
    expect(await repo.findById(created.id, ctx)).toBeNull();
  });

  it('update ignores sentinel fields (cannot soft-delete or deactivate via update)', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'keep' }, ctx);
    await repo.update(created.id, { name: 'renamed', isDeleted: true, isActive: false } as any, ctx);
    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();          // not soft-deleted
    expect(found?.name).toBe('renamed');   // legit field still applied
    expect(found?.isActive).toBe(true);    // isActive NOT flipped
  });
});
