import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { TeamRepository } from './team.repo';
import { DepartmentRepository } from '../module-department/department.repo';

describe('TeamRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: TeamRepository;
  let deptRepo: DepartmentRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new TeamRepository(dbProvider);
    deptRepo = new DepartmentRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const dept = await deptRepo.create({ name: 'Engineering Dept' }, ctx);
    const created = await repo.create(
      { name: 'Frontend Team', departmentId: dept.id },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Frontend Team');
    expect(created.departmentId).toBe(dept.id);

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Frontend Team');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const dept = await deptRepo.create({ name: 'Design Dept' }, ctx);
    const team = await repo.create({ name: 'Temp Team', departmentId: dept.id }, ctx);
    await repo.delete(team.id, ctx);
    const found = await repo.findById(team.id, ctx);
    expect(found).toBeNull();
  });

  it('findByDepartmentId returns teams for a department', async () => {
    const ctx = getCtx();
    const dept = await deptRepo.create({ name: 'Product Dept' }, ctx);
    const team1 = await repo.create({ name: 'Mobile Team', departmentId: dept.id }, ctx);
    const team2 = await repo.create({ name: 'Backend Team', departmentId: dept.id }, ctx);

    const teams = await repo.findByDepartmentId(dept.id, ctx);
    const ids = teams.map((t) => t.id);
    expect(ids).toContain(team1.id);
    expect(ids).toContain(team2.id);
  });

  it('findByDepartmentId excludes soft-deleted teams', async () => {
    const ctx = getCtx();
    const dept = await deptRepo.create({ name: 'QA Dept' }, ctx);
    const team = await repo.create({ name: 'Deleted Team', departmentId: dept.id }, ctx);
    await repo.delete(team.id, ctx);

    const teams = await repo.findByDepartmentId(dept.id, ctx);
    const ids = teams.map((t) => t.id);
    expect(ids).not.toContain(team.id);
  });

  it('update with isDeleted=true does NOT soft-delete the row', async () => {
    const ctx = getCtx();
    const dept = await deptRepo.create({ name: 'Sales Dept' }, ctx);
    const created = await repo.create({ name: 'Durable Team', departmentId: dept.id }, ctx);
    await repo.update(created.id, { isDeleted: true } as any, ctx);
    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });
});
