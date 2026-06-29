import { FileStorageService } from './file.storage.service';

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    _store: store,
  };
};

describe('FileStorageService', () => {
  it('caches the preview url under the second call', async () => {
    const cache = makeCache();
    const adapter = { getPreviewUrl: jest.fn().mockResolvedValue('signed://url') } as any;
    const svc = new FileStorageService(cache as any, adapter);

    const a = await svc.getPreviewUrlByPath('public', 'private', 'general/x', 'tok');
    const b = await svc.getPreviewUrlByPath('public', 'private', 'general/x', 'tok');

    expect(a).toBe('signed://url');
    expect(b).toBe('signed://url');
    expect(adapter.getPreviewUrl).toHaveBeenCalledTimes(1); // second served from cache
  });

  it('cropImageThumbnails only makes the sizes the height supports', async () => {
    const cache = makeCache();
    const adapter = { cropImage: jest.fn().mockImplementation(async (_b, _p, _w, h) => `thumb-${h}`) } as any;
    const svc = new FileStorageService(cache as any, adapter);

    const out = await svc.cropImageThumbnails('private', 'general/x', 100); // > 56, < 525
    expect(out.sm).toBe('thumb-56');
    expect(out.lg).toBeUndefined();
  });
});
