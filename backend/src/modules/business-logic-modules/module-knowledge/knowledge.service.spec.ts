import { defineAbilityFor } from 'src/common/casl/ability.factory';
import { KnowledgeService } from './knowledge.service';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;
const userSession = (over: any = {}) => ({ id: 7, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over });

const makeRepo = () => ({
  create: jest.fn(async (i) => ({ id: 1, slug: 'k-1', visibility: i.visibility ?? 'private', ...i })),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByIds: jest.fn(async () => []),
  update: jest.fn(async (_id, p) => ({ id: 1, slug: 'k-1', title: 'T', ownerPersonId: 7, visibility: 'private', ...p })),
  delete: jest.fn(),
  query: jest.fn(async () => ({ data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }, error: null })),
  findShareePersonIds: jest.fn(async () => []),
  findSharedKnowledgeIdsForPerson: jest.fn(async () => []),
  findTaskIds: jest.fn(async () => []),
});

describe('KnowledgeService — read authorization', () => {
  let repo: any; let personRepo: any; let taskRepo: any; let files: any; let svc: KnowledgeService;
  beforeEach(() => {
    repo = makeRepo();
    personRepo = { findById: jest.fn(async () => ({ id: 2 })) };
    taskRepo = { findById: jest.fn() };
    files = { getLinkByIds: jest.fn(async () => []) };
    svc = new KnowledgeService(repo, personRepo, taskRepo, files);
  });

  const knol = (over: any) => ({ id: 1, slug: 'k-1', title: 'T', body: null, ownerPersonId: 1, visibility: 'private', ...over });

  it('owner can read own private knowledge', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 9 }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('non-owner cannot read others private knowledge', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'private' }), ctx, ability, userSession({ id: 9 }))).rejects.toBeDefined();
  });

  it('organization knowledge is readable by any member', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'organization' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('shared knowledge is readable by an explicit grantee (service-layer)', async () => {
    repo.findShareePersonIds.mockResolvedValue([9]);
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'shared' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('shared knowledge is NOT readable by a non-grantee', async () => {
    repo.findShareePersonIds.mockResolvedValue([3]);
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'shared' }), ctx, ability, userSession({ id: 9 }))).rejects.toBeDefined();
  });

  it('private knowledge attached to a readable task grants task-scoped read', async () => {
    repo.findTaskIds.mockResolvedValue([100]);
    taskRepo.findById.mockResolvedValue({ id: 100, createdByPersonId: 9 }); // member can read any Task
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'private' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('update is rejected for a non-owner member', async () => {
    repo.findBySlug.mockResolvedValue(knol({ ownerPersonId: 1 }));
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.update('k-1', { title: 'New' }, ctx, ability)).rejects.toBeDefined();
  });

  it('create sets the owner from the session', async () => {
    await svc.create({ title: 'X' }, 7, ctx);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'X', ownerPersonId: 7 }), ctx);
  });

  it('search computes shared ids and unrestricted=false for members', async () => {
    repo.findSharedKnowledgeIdsForPerson.mockResolvedValue([5]);
    await svc.search({}, ctx, userSession({ id: 7, role: 'member' }));
    expect(repo.query).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 7, sharedIds: [5], unrestricted: false }), ctx);
  });

  it('search is unrestricted for admin', async () => {
    await svc.search({}, ctx, userSession({ id: 7, role: 'admin' }));
    expect(repo.query).toHaveBeenCalledWith(expect.objectContaining({ unrestricted: true }), ctx);
  });
});
