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
  const service = new PersonService(repo, cache);
  return { service, repo, cache };
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
