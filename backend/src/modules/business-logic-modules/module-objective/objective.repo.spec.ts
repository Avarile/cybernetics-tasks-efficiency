import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { ObjectiveRepository } from './objective.repo';
import { PersonRepository } from '../module-person/person.repo';

describe('ObjectiveRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: ObjectiveRepository;
  let personRepo: PersonRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new ObjectiveRepository(dbProvider);
    personRepo = new PersonRepository(dbProvider);
  });

  it('create then findById returns the row with ownerName', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'Alice Owner', email: 'alice@obj.com', role: 'manager' }, ctx);

    const created = await repo.create({
      title: 'Grow Revenue',
      ownerPersonId: owner.id,
      scope: 'org',
      period: '2024-Q1',
      status: 'draft',
    }, ctx);
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Grow Revenue');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Grow Revenue');
    expect(found?.ownerName).toBe('Alice Owner');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'Bob Del', email: 'bob@obj.com', role: 'member' }, ctx);
    const obj = await repo.create({
      title: 'To Delete',
      ownerPersonId: owner.id,
      scope: 'team',
      period: '2024-Q2',
      status: 'draft',
    }, ctx);
    await repo.delete(obj.id, ctx);
    const found = await repo.findById(obj.id, ctx);
    expect(found).toBeNull();
  });

  it('findByOwner returns objectives for that owner', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'Carol Own', email: 'carol@obj.com', role: 'manager' }, ctx);
    const other = await personRepo.create({ name: 'Dave Other', email: 'dave@obj.com', role: 'member' }, ctx);

    await repo.create({ title: 'Carol Obj 1', ownerPersonId: owner.id, scope: 'org', period: '2024-Q3', status: 'active' }, ctx);
    await repo.create({ title: 'Carol Obj 2', ownerPersonId: owner.id, scope: 'team', period: '2024-Q3', status: 'draft' }, ctx);
    await repo.create({ title: 'Dave Obj', ownerPersonId: other.id, scope: 'org', period: '2024-Q3', status: 'active' }, ctx);

    const results = await repo.findByOwner(owner.id, ctx);
    const titles = results.map(r => r.title);
    expect(titles).toContain('Carol Obj 1');
    expect(titles).toContain('Carol Obj 2');
    expect(titles).not.toContain('Dave Obj');
  });

  it('findByScope returns objectives matching scope and scopeRefId', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'Eve Scope', email: 'eve@obj.com', role: 'manager' }, ctx);

    await repo.create({ title: 'Dept Obj 1', ownerPersonId: owner.id, scope: 'department', scopeRefId: 10, period: '2024-Q4', status: 'active' }, ctx);
    await repo.create({ title: 'Dept Obj 2', ownerPersonId: owner.id, scope: 'department', scopeRefId: 10, period: '2024-Q4', status: 'draft' }, ctx);
    await repo.create({ title: 'Other Dept', ownerPersonId: owner.id, scope: 'department', scopeRefId: 99, period: '2024-Q4', status: 'active' }, ctx);

    const results = await repo.findByScope('department', 10, ctx);
    const titles = results.map(r => r.title);
    expect(titles).toContain('Dept Obj 1');
    expect(titles).toContain('Dept Obj 2');
    expect(titles).not.toContain('Other Dept');
  });
});
