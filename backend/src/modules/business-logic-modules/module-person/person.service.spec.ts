import { PersonService } from './person.service';
import { cacheKey } from 'src/infra/cache/cache.constants';

const CTX = { database_uri: 'u', schema_id: 'public', user_id: 1 } as any;
const ABILITY = { cannot: jest.fn().mockReturnValue(false) } as any;

function setup() {
  const repo = {
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as any;
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as any;
  const files = { getLinkByIds: jest.fn() } as any;
  const service = new PersonService(repo, cache, files);
  return { service, repo, cache, files };
}

describe('PersonService cache invalidation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busts the account key after update', async () => {
    const { service, repo, cache } = setup();
    const existing = { id: 7, name: 'A' };
    repo.findById.mockResolvedValue(existing);
    repo.update.mockResolvedValue({ ...existing, name: 'B' });

    await service.update(7, { name: 'B' } as any, CTX, ABILITY);

    expect(cache.del).toHaveBeenCalledWith(cacheKey.account('public', 7));
  });

  it('busts the account key after remove', async () => {
    const { service, repo, cache } = setup();
    repo.findById.mockResolvedValue({ id: 7 });

    await service.remove(7, CTX);

    expect(cache.del).toHaveBeenCalledWith(cacheKey.account('public', 7));
  });
});

describe('PersonService avatar resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attachAvatarUrl resolves the avatar attachment to a url', async () => {
    const { service, files } = setup();
    files.getLinkByIds.mockResolvedValue([{ id: 9, slug: 's', url: 'pic://9', mimetype: 'image/png', thumbnailPath: null }]);
    const out = await service.attachAvatarUrl({ id: 1, avatarAttachmentId: 9 } as any, CTX);
    expect(out.avatarUrl).toBe('pic://9');
    expect(files.getLinkByIds).toHaveBeenCalledWith([9], CTX);
  });

  it('attachAvatarUrl returns null when no avatar is set', async () => {
    const { service, files } = setup();
    const out = await service.attachAvatarUrl({ id: 1, avatarAttachmentId: null } as any, CTX);
    expect(out.avatarUrl).toBeNull();
    expect(files.getLinkByIds).not.toHaveBeenCalled();
  });
});
