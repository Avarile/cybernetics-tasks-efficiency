import { TaskService } from './task.service';
import { defineAbilityFor } from 'src/common/casl/ability.factory';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;
const user = (over: Partial<IUserSession>): IUserSession =>
  ({ id: 7, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over });

describe('TaskService', () => {
  let repo: any;
  let service: TaskService;

  let initiativeRepo: any;
  let personRepo: any;
  let labelRepo: any;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (i) => ({ id: 1, slug: 's1', sequenceId: 1, status: 'not_started', ...i })),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      update: jest.fn(async (id, p) => ({ id, ...p })),
      delete: jest.fn(),
      countByInitiative: jest.fn(async () => ({ total: 0, byStatus: {} })),
    };
    initiativeRepo = { findById: jest.fn(async () => ({ id: 1 })) };
    personRepo = { findById: jest.fn(async () => ({ id: 7 })) };
    labelRepo = { findById: jest.fn(async () => ({ id: 1 })) };
    service = new TaskService(repo, initiativeRepo, personRepo, labelRepo);
  });

  it('create delegates to repo', async () => {
    const out = await service.create({ initiativeId: 1, title: 'T', priority: 'none', createdByPersonId: 7 } as any, ctx);
    expect(out.id).toBe(1);
    expect(repo.create).toHaveBeenCalled();
  });

  it('create throws when initiative does not exist', async () => {
    initiativeRepo.findById.mockResolvedValue(null);
    await expect(service.create({ initiativeId: 99, title: 'T', priority: 'none', createdByPersonId: 7 } as any, ctx)).rejects.toBeDefined();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('update forbids a member editing a task they did not create', async () => {
    repo.findById.mockResolvedValue({ id: 1, createdByPersonId: 999, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    await expect(service.update(1, { title: 'Y' } as any, ctx, ability)).rejects.toBeDefined();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update allows a member editing their own task', async () => {
    repo.findById.mockResolvedValue({ id: 1, createdByPersonId: 7, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    await service.update(1, { title: 'Y' } as any, ctx, ability);
    expect(repo.update).toHaveBeenCalledWith(1, { title: 'Y' }, ctx);
  });

  it('requireBySlugForWrite denies a member modifying a task they did not create', async () => {
    repo.findBySlug.mockResolvedValue({ id: 1, slug: 's1', createdByPersonId: 999, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    await expect(service.requireBySlugForWrite('s1', ctx, ability)).rejects.toBeDefined();
  });

  it('requireBySlugForWrite allows a member modifying their own task', async () => {
    repo.findBySlug.mockResolvedValue({ id: 1, slug: 's1', createdByPersonId: 7, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    const t = await service.requireBySlugForWrite('s1', ctx, ability);
    expect(t.id).toBe(1);
  });
});
