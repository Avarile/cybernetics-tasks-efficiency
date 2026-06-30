import 'dotenv/config';
import { useTestSchema } from '../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { FileRepository } from './file.repo';
import { FilePurpose, INewAttachment } from './file.interface';

describe('FileRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: FileRepository;
  beforeAll(() => { repo = new FileRepository(new ApplicationDBProvider()); });

  const base = (token: string): INewAttachment => ({
    token, bucket: 'private', path: `general/${token}`, hash: 'h', size: 10,
    mimetype: 'text/plain', purpose: FilePurpose.General, createdByPersonId: 1,
  });

  it('create then findByToken / findBySlug round-trips', async () => {
    const ctx = getCtx();
    const row = await repo.create(base('tok-a'), ctx);
    expect(row.slug).toBeTruthy();
    expect((await repo.findByToken('tok-a', ctx))!.id).toBe(row.id);
    expect((await repo.findBySlug(row.slug, ctx))!.token).toBe('tok-a');
  });

  it('setThumbnailPath persists JSON', async () => {
    const ctx = getCtx();
    await repo.create(base('tok-b'), ctx);
    await repo.setThumbnailPath('tok-b', JSON.stringify({ sm: 's', lg: 'l' }), ctx);
    expect((await repo.findByToken('tok-b', ctx))!.thumbnailPath).toBe('{"sm":"s","lg":"l"}');
  });

  it('delete soft-deletes', async () => {
    const ctx = getCtx();
    const row = await repo.create(base('tok-c'), ctx);
    await repo.delete(row.id, ctx);
    expect(await repo.findById(row.id, ctx)).toBeNull();
  });

  it('findByIds returns only the requested live rows', async () => {
    const ctx = getCtx();
    const a = await repo.create(base('tok-ids-1'), ctx);
    const b = await repo.create(base('tok-ids-2'), ctx);
    const rows = await repo.findByIds([a.id, b.id, 999999], ctx);
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });
});
