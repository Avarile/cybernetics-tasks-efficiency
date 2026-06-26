import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { KeyResultRepository } from './key-result.repo';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { PersonRepository } from '../module-person/person.repo';

describe('KeyResultRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: KeyResultRepository;
  let objRepo: ObjectiveRepository;
  let personRepo: PersonRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new KeyResultRepository(dbProvider);
    objRepo = new ObjectiveRepository(dbProvider);
    personRepo = new PersonRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'KR Owner', email: 'krowner@kr.com', role: 'manager' }, ctx);
    const obj = await objRepo.create({ title: 'KR Objective', ownerPersonId: owner.id, scope: 'org', period: '2024-Q1', status: 'active' }, ctx);

    const created = await repo.create({
      objectiveId: obj.id,
      title: 'Increase Revenue',
      metricType: 'currency',
      startValue: '0',
      targetValue: '1000000',
      currentValue: '0',
      direction: 'increase',
    }, ctx);
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Increase Revenue');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Increase Revenue');
    expect(found?.objectiveId).toBe(obj.id);
  });

  it('findByObjectiveId returns all KRs for that objective', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'KR Owner2', email: 'krowner2@kr.com', role: 'manager' }, ctx);
    const obj = await objRepo.create({ title: 'KR Objective 2', ownerPersonId: owner.id, scope: 'team', period: '2024-Q2', status: 'active' }, ctx);
    const obj2 = await objRepo.create({ title: 'KR Objective 3', ownerPersonId: owner.id, scope: 'org', period: '2024-Q2', status: 'active' }, ctx);

    await repo.create({ objectiveId: obj.id, title: 'KR 1', metricType: 'percent', startValue: '0', targetValue: '100', currentValue: '0', direction: 'increase' }, ctx);
    await repo.create({ objectiveId: obj.id, title: 'KR 2', metricType: 'number', startValue: '100', targetValue: '0', currentValue: '100', direction: 'decrease' }, ctx);
    await repo.create({ objectiveId: obj2.id, title: 'KR Other', metricType: 'boolean', startValue: '0', targetValue: '1', currentValue: '0', direction: 'increase' }, ctx);

    const results = await repo.findByObjectiveId(obj.id, ctx);
    const titles = results.map(r => r.title);
    expect(titles).toContain('KR 1');
    expect(titles).toContain('KR 2');
    expect(titles).not.toContain('KR Other');
  });

  it('updateCurrentValue changes currentValue', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'KR Owner3', email: 'krowner3@kr.com', role: 'manager' }, ctx);
    const obj = await objRepo.create({ title: 'KR Objective 4', ownerPersonId: owner.id, scope: 'org', period: '2024-Q3', status: 'active' }, ctx);

    const kr = await repo.create({
      objectiveId: obj.id,
      title: 'Revenue Track',
      metricType: 'currency',
      startValue: '0',
      targetValue: '500000',
      currentValue: '0',
      direction: 'increase',
    }, ctx);

    const updated = await repo.updateCurrentValue(kr.id, '250000', ctx);
    expect(updated.currentValue).toBe('250000.0000');

    const found = await repo.findById(kr.id, ctx);
    expect(found?.currentValue).toBe('250000.0000');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const owner = await personRepo.create({ name: 'KR Owner4', email: 'krowner4@kr.com', role: 'manager' }, ctx);
    const obj = await objRepo.create({ title: 'KR Objective 5', ownerPersonId: owner.id, scope: 'team', period: '2024-Q4', status: 'active' }, ctx);

    const kr = await repo.create({
      objectiveId: obj.id,
      title: 'To Delete KR',
      metricType: 'number',
      startValue: '0',
      targetValue: '100',
      currentValue: '0',
      direction: 'increase',
    }, ctx);

    await repo.delete(kr.id, ctx);
    const found = await repo.findById(kr.id, ctx);
    expect(found).toBeNull();
  });
});
