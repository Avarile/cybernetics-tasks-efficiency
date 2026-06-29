import 'dotenv/config';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { useTestSchema } from '../../../test/db-setup';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { QueueName } from 'src/infra/queue/queue.constants';
import { FileService } from './file.service';
import { FileStorageService } from './file.storage.service';
import { FileRepository } from './file.repo';
import { FilePurpose } from './file.interface';
import { STORAGE_ADAPTER } from './plugins/adapter';
import { LocalStorage } from './plugins/local';

describe('FileManagement (local provider integration)', () => {
  const { getCtx } = useTestSchema();
  const storageDir = mkdtempSync(join(tmpdir(), 'cyb-int-'));
  let service: FileService;
  let repo: FileRepository;
  let local: LocalStorage;
  const store = new Map<string, unknown>();
  const cache = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => void store.set(k, v),
    del: async (k: string) => void store.delete(k),
  };

  beforeAll(async () => {
    // Bespoke provider set (not FileManagementModule) so we exercise the real
    // DB + local adapter without standing up the BullMQ worker / Redis.
    const moduleRef = await Test.createTestingModule({
      imports: [ApplicationDbModule],
      providers: [
        FileRepository,
        FileStorageService,
        FileService,
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: STORAGE_ADAPTER, useValue: new LocalStorage(storageDir, 'integration-secret') },
        { provide: getQueueToken(QueueName.FILE_CROP), useValue: { add: jest.fn() } },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(FileService);
    repo = moduleRef.get(FileRepository);
    local = moduleRef.get(STORAGE_ADAPTER);
  }, 30_000);

  it('signature → place file → notify creates a row and a read link', async () => {
    const ctx = getCtx();
    // signature() and notify() both use the passed ctx (test schema); only the
    // @Public upload route uses dbContext.system(), which is why we drive notify directly here.
    const sig = await service.signature(
      { purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 },
      ctx,
    );
    // simulate the client PUT: place the bytes where the adapter expects them
    await local.uploadFileWithPath('private', sig.path, writeTemp('hello'));
    // signature() already cached file:sig under ctx.schema_id; seed the upload
    // cache the way uploadLocal would (the @Public upload route is covered separately)
    store.set(`cyb:${ctx.schema_id}:file:upload:${sig.token}`, { mimetype: 'text/plain', hash: 'h', size: 5 });

    const res = await service.notify(sig.token, ctx);
    expect(res.presignedUrl).toContain('/api/files/read/');

    const row = await repo.findByToken(sig.token, ctx);
    expect(row).not.toBeNull();
    expect(row!.bucket).toBe('private');
  });
});

function writeTemp(content: string): string {
  const p = join(mkdtempSync(join(tmpdir(), 'cyb-src-')), 'f');
  writeFileSync(p, content);
  return p;
}
