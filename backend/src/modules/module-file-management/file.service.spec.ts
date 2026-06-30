import { FileService } from './file.service';
import { FilePurpose } from './file.interface';
import { cacheKey } from 'src/infra/cache/cache.constants';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    del: jest.fn(async (k: string) => void store.delete(k)),
  };
};

describe('FileService', () => {
  let repo: any; let storageSvc: any; let adapter: any; let cache: any; let queue: any; let svc: FileService;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (i) => ({ id: 1, slug: 'slug-1', ...i })),
      findByToken: jest.fn(),
    };
    storageSvc = { getPreviewUrlByPath: jest.fn(async () => 'signed://url') };
    adapter = {
      presigned: jest.fn(async () => ({ token: 'tok', path: 'general/tok', url: 'u', uploadMethod: 'PUT', requestHeaders: {} })),
      getObjectMeta: jest.fn(async () => ({ hash: 'h', size: 5, mimetype: 'text/plain', url: '/private/general/tok' })),
    };
    cache = makeCache();
    queue = { add: jest.fn() };
    // 6th arg is DbContextService; only uploadLocal/readLocalFile use it (untested here)
    svc = new FileService(repo, storageSvc, adapter, cache, queue, { system: () => ctx } as any);
  });

  it('signature rejects oversized files', async () => {
    await expect(
      svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 999999999999 }, ctx),
    ).rejects.toBeDefined();
    expect(adapter.presigned).not.toHaveBeenCalled();
  });

  it('signature presigns and caches the token', async () => {
    const res = await svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 }, ctx);
    expect(res.token).toBe('tok');
    expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('file:sig:tok'), expect.objectContaining({ bucket: 'private' }), expect.any(Number));
  });

  it('notify throws on an unknown token', async () => {
    await expect(svc.notify('missing', ctx)).rejects.toBeDefined();
  });

  it('notify creates the row, enqueues a crop job, and returns a link', async () => {
    await svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 }, ctx);
    // simulate uploadLocal having completed (local provider): seed the upload-meta cache
    await cache.set(cacheKey.fileUpload('public', 'tok'), { mimetype: 'text/plain', hash: 'h', size: 5 });
    const out = await svc.notify('tok', ctx);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok', createdByPersonId: 7 }), ctx);
    expect(queue.add).toHaveBeenCalled();
    expect(out.presignedUrl).toBe('signed://url');
    expect(out.slug).toBe('slug-1');
  });

  it('notify is idempotent — returns existing row without re-creating', async () => {
    repo.findByToken.mockResolvedValue({
      token: 'tok', slug: 'slug-1', bucket: 'private', path: 'general/tok',
      size: 5, mimetype: 'text/plain', width: null, height: null,
    });
    const out = await svc.notify('tok', ctx);
    expect(out.slug).toBe('slug-1');
    expect(repo.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('getLinkByIds resolves ids to preview urls with no per-attachment CASL', async () => {
    repo.findByIds = jest.fn(async () => [
      { id: 3, slug: 'sl-3', bucket: 'private', path: 'general/x', token: 'tk', mimetype: 'image/png', thumbnailPath: '{"sm":"s"}' },
    ]);
    const out = await svc.getLinkByIds([3], ctx);
    expect(out).toEqual([
      { id: 3, slug: 'sl-3', url: 'signed://url', mimetype: 'image/png', thumbnailPath: '{"sm":"s"}' },
    ]);
    expect(storageSvc.getPreviewUrlByPath).toHaveBeenCalledWith(
      'public', 'private', 'general/x', 'tk', undefined, { 'Content-Type': 'image/png' },
    );
  });
});
