import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { KnowledgeRepository } from './knowledge.repo';

describe('KnowledgeRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: KnowledgeRepository;
  beforeAll(() => { repo = new KnowledgeRepository(new ApplicationDBProvider()); });

  it('create then findBySlug / findById round-trips', async () => {
    const ctx = getCtx();
    const row = await repo.create({ title: 'Note A', body: 'hello', ownerPersonId: 1 }, ctx);
    expect(row.slug).toBeTruthy();
    expect(row.visibility).toBe('private');
    expect((await repo.findBySlug(row.slug, ctx))!.id).toBe(row.id);
    expect((await repo.findById(row.id, ctx))!.title).toBe('Note A');
  });

  it('share link/unlink + lookups', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'B', ownerPersonId: 1 }, ctx);
    await repo.linkShare(k.id, 2, ctx);
    await repo.linkShare(k.id, 2, ctx); // idempotent
    expect(await repo.findShareePersonIds(k.id, ctx)).toEqual([2]);
    expect(await repo.findSharedKnowledgeIdsForPerson(2, ctx)).toContain(k.id);
    await repo.unlinkShare(k.id, 2, ctx);
    expect(await repo.findShareePersonIds(k.id, ctx)).toEqual([]);
  });

  it('links add/remove/list', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'C', ownerPersonId: 1 }, ctx);
    const link = await repo.addLink(k.id, 'https://x.test', 'X', ctx);
    expect((await repo.findLinks(k.id, ctx)).map((l: { url: string }) => l.url)).toEqual(['https://x.test']);
    await repo.removeLink(k.id, link.id, ctx);
    expect(await repo.findLinks(k.id, ctx)).toEqual([]);
  });

  it('attachments link/unlink + list ids', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'D', ownerPersonId: 1 }, ctx);
    await repo.linkAttachment(k.id, 55, ctx);
    expect(await repo.findAttachmentIds(k.id, ctx)).toEqual([55]);
    await repo.unlinkAttachment(k.id, 55, ctx);
    expect(await repo.findAttachmentIds(k.id, ctx)).toEqual([]);
  });

  it('task link/unlink + both-direction lookups', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'E', ownerPersonId: 1 }, ctx);
    await repo.linkTask(100, k.id, 1, ctx);
    expect(await repo.findTaskIds(k.id, ctx)).toEqual([100]);
    expect(await repo.findKnowledgeIdsForTask(100, ctx)).toContain(k.id);
    await repo.unlinkTask(100, k.id, ctx);
    expect(await repo.findTaskIds(k.id, ctx)).toEqual([]);
  });

  it('update changes visibility; delete soft-deletes', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'F', ownerPersonId: 1 }, ctx);
    const u = await repo.update(k.id, { visibility: 'organization' }, ctx);
    expect(u.visibility).toBe('organization');
    await repo.delete(k.id, ctx);
    expect(await repo.findById(k.id, ctx)).toBeNull();
  });

  it('findByIds returns requested live rows', async () => {
    const ctx = getCtx();
    const a = await repo.create({ title: 'G', ownerPersonId: 1 }, ctx);
    const b = await repo.create({ title: 'H', ownerPersonId: 1 }, ctx);
    const rows = await repo.findByIds([a.id, b.id], ctx);
    expect(rows.map((r: { id: number }) => r.id).sort()).toEqual([a.id, b.id].sort());
  });
});
