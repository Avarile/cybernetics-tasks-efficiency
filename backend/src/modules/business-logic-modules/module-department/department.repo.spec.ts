import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { DepartmentRepository } from './department.repo';

describe('DepartmentRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: DepartmentRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new DepartmentRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { name: 'Engineering', description: 'Engineering dept' },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Engineering');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Engineering');
    expect(found?.description).toBe('Engineering dept');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const dept = await repo.create({ name: 'Temp Dept' }, ctx);
    await repo.delete(dept.id, ctx);
    const found = await repo.findById(dept.id, ctx);
    expect(found).toBeNull();
  });

  it('findByParentId returns child departments', async () => {
    const ctx = getCtx();
    const parent = await repo.create({ name: 'Parent Dept' }, ctx);
    const child1 = await repo.create({ name: 'Child Dept 1', parentId: parent.id }, ctx);
    const child2 = await repo.create({ name: 'Child Dept 2', parentId: parent.id }, ctx);

    const children = await repo.findByParentId(parent.id, ctx);
    const ids = children.map((d) => d.id);
    expect(ids).toContain(child1.id);
    expect(ids).toContain(child2.id);
  });

  it('findByParentId excludes soft-deleted children', async () => {
    const ctx = getCtx();
    const parent = await repo.create({ name: 'Parent Dept 2' }, ctx);
    const child = await repo.create({ name: 'Deleted Child', parentId: parent.id }, ctx);
    await repo.delete(child.id, ctx);

    const children = await repo.findByParentId(parent.id, ctx);
    const ids = children.map((d) => d.id);
    expect(ids).not.toContain(child.id);
  });

  it('findRoots returns departments with no parentId', async () => {
    const ctx = getCtx();
    const root1 = await repo.create({ name: 'Root Dept A' }, ctx);
    const root2 = await repo.create({ name: 'Root Dept B' }, ctx);
    const child = await repo.create({ name: 'Non-root Dept', parentId: root1.id }, ctx);

    const roots = await repo.findRoots(ctx);
    const ids = roots.map((d) => d.id);
    expect(ids).toContain(root1.id);
    expect(ids).toContain(root2.id);
    expect(ids).not.toContain(child.id);
  });

  it('findRoots excludes soft-deleted departments', async () => {
    const ctx = getCtx();
    const root = await repo.create({ name: 'Deleted Root' }, ctx);
    await repo.delete(root.id, ctx);

    const roots = await repo.findRoots(ctx);
    const ids = roots.map((d) => d.id);
    expect(ids).not.toContain(root.id);
  });

  it('update with isDeleted=true does NOT soft-delete the row', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'Durable Dept' }, ctx);
    await repo.update(created.id, { isDeleted: true } as any, ctx);
    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });
});
