import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { TaskRepository } from './task.repo';

describe('TaskRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: TaskRepository;
  beforeAll(() => { repo = new TaskRepository(new ApplicationDBProvider()); });

  const base = { initiativeId: 1, createdByPersonId: 1, priority: 'none' as const };

  it('create assigns an org-wide sequenceId and defaults status', async () => {
    const ctx = getCtx();
    const a = await repo.create({ ...base, title: 'First' }, ctx);
    const b = await repo.create({ ...base, title: 'Second' }, ctx);
    expect(a.sequenceId).not.toBeNull();
    expect(b.sequenceId).toBe((a.sequenceId as number) + 1);
    expect(a.status).toBe('not_started');
  });

  it('delete soft-deletes', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Temp' }, ctx);
    await repo.delete(t.id, ctx);
    expect(await repo.findById(t.id, ctx)).toBeNull();
  });

  it('findChildren returns sub-tasks of a parent', async () => {
    const ctx = getCtx();
    const parent = await repo.create({ ...base, title: 'Parent' }, ctx);
    await repo.create({ ...base, title: 'Child', parentId: parent.id }, ctx);
    const kids = await repo.findChildren(parent.id, ctx);
    expect(kids.map((k) => k.title)).toContain('Child');
  });

  it('countByInitiative aggregates by status', async () => {
    const ctx = getCtx();
    await repo.create({ ...base, initiativeId: 555, title: 'X' }, ctx);
    await repo.create({ ...base, initiativeId: 555, title: 'Y' }, ctx);
    const summary = await repo.countByInitiative(555, ctx);
    expect(summary.total).toBe(2);
    expect(summary.byStatus.not_started).toBe(2);
  });

  it('linkAssignee is idempotent and listed by findAssigneeIds', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Assignee Test' }, ctx);
    await repo.linkAssignee(t.id, 9, ctx);
    await repo.linkAssignee(t.id, 9, ctx);
    expect(await repo.findAssigneeIds(t.id, ctx)).toEqual([9]);
    await repo.unlinkAssignee(t.id, 9, ctx);
    expect(await repo.findAssigneeIds(t.id, ctx)).not.toContain(9);
  });

  it('addLabel is idempotent and listed by findLabelIds', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Label Test' }, ctx);
    await repo.addLabel(t.id, 3, ctx);
    await repo.addLabel(t.id, 3, ctx);
    expect(await repo.findLabelIds(t.id, ctx)).toEqual([3]);
    await repo.removeLabel(t.id, 3, ctx);
    expect(await repo.findLabelIds(t.id, ctx)).not.toContain(3);
  });
});
