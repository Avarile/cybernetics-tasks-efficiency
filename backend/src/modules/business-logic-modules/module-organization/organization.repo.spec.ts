import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { OrganizationRepository } from './organization.repo';

describe('OrganizationRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: OrganizationRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new OrganizationRepository(dbProvider);
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create(
      { name: 'Acme Corp', description: 'Test org' },
      ctx,
    );
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Acme Corp');

    const found = await repo.findById(created.id, ctx);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Acme Corp');
    expect(found?.description).toBe('Test org');
  });

  it('delete soft-deletes (row hidden from findById)', async () => {
    const ctx = getCtx();
    const org = await repo.create({ name: 'Temp Org' }, ctx);
    await repo.delete(org.id, ctx);
    const found = await repo.findById(org.id, ctx);
    expect(found).toBeNull();
  });

  it('findByName returns matching org', async () => {
    const ctx = getCtx();
    await repo.create({ name: 'Globex', description: null }, ctx);
    const found = await repo.findByName('Globex', ctx);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Globex');
  });

  it('query filters by name (ilike)', async () => {
    const ctx = getCtx();
    await repo.create({ name: 'Initech Solutions' }, ctx);
    const result = await repo.query({ name: 'initech' }, ctx);
    const names = (result.data as any[]).map((o) => o.name);
    expect(names).toContain('Initech Solutions');
  });

  it('update modifies the organization', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'Old Name' }, ctx);
    const updated = await repo.update(created.id, { name: 'New Name' }, ctx);
    expect(updated?.name).toBe('New Name');
    const found = await repo.findById(created.id, ctx);
    expect(found?.name).toBe('New Name');
  });
});
