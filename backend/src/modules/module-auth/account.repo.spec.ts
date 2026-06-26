import 'dotenv/config';
import { useTestSchema } from '../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { PersonAccountRepository } from './account.repo';
import { PersonRepository } from '../business-logic-modules/module-person/person.repo';

describe('PersonAccountRepository.findByEmail (real DB)', () => {
  const { getCtx } = useTestSchema();
  let accountRepo: PersonAccountRepository;
  let personRepo: PersonRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    accountRepo = new PersonAccountRepository(dbProvider);
    personRepo = new PersonRepository(dbProvider);
  });

  it('returns a person when email, isDeleted=false, isActive=true', async () => {
    const ctx = getCtx();
    await accountRepo.createPerson(
      { name: 'Active User', email: 'active@test.com', passwordHash: 'hash', role: 'member' },
      ctx,
    );
    const found = await accountRepo.findByEmail('active@test.com', ctx);
    expect(found).not.toBeNull();
    expect(found?.email).toBe('active@test.com');
  });

  it('returns null when person is soft-deleted (isDeleted=true)', async () => {
    const ctx = getCtx();
    const created = await accountRepo.createPerson(
      { name: 'Deleted User', email: 'deleted@test.com', passwordHash: 'hash', role: 'member' },
      ctx,
    );
    // Soft-delete via PersonRepository (which owns the delete operation)
    await personRepo.delete(created.id, ctx);

    const found = await accountRepo.findByEmail('deleted@test.com', ctx);
    expect(found).toBeNull();
  });

  it('returns null when person is inactive (isActive=false)', async () => {
    const ctx = getCtx();
    const created = await accountRepo.createPerson(
      { name: 'Inactive User', email: 'inactive@test.com', passwordHash: 'hash', role: 'member' },
      ctx,
    );
    // Set isActive=false via PersonRepository update
    await personRepo.update(created.id, { isActive: false }, ctx);

    const found = await accountRepo.findByEmail('inactive@test.com', ctx);
    expect(found).toBeNull();
  });
});
