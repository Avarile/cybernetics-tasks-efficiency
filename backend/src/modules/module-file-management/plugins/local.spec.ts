import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { LocalStorage } from './local';

describe('LocalStorage', () => {
  let storage: LocalStorage;
  const dir = mkdtempSync(join(tmpdir(), 'cyb-local-'));

  beforeAll(() => {
    storage = new LocalStorage(dir, 'unit-test-secret');
  });

  it('presigned returns an app upload url and PUT method', async () => {
    const res = await storage.presigned('private', 'general', { contentType: 'image/png', contentLength: 3 });
    expect(res.url).toContain('/api/v1/files/upload/');
    expect(res.uploadMethod).toBe('PUT');
    expect(res.path).toBe(join('general', res.token));
  });

  it('uploadFile writes bytes and getObjectMeta reports them back', async () => {
    const body = Buffer.from('hello');
    await storage.uploadFile('private', 'general/abc', body, { 'Content-Type': 'text/plain' });
    const meta = await storage.getObjectMeta('private', 'general/abc', {
      mimetype: 'text/plain', hash: 'h', size: body.length,
    });
    expect(meta.size).toBe(5);
    expect(meta.mimetype).toBe('text/plain');
    expect(meta.url).toContain('/api/v1/files/read/');
    // the bytes really landed on disk
    expect(readFileSync(resolve(storage.storageDir, 'private', 'general/abc')).toString()).toBe('hello');
  });

  it('getPreviewUrl emits a token that verifyReadToken accepts', async () => {
    const url = await storage.getPreviewUrl('private', 'general/abc', 600, { 'Content-Type': 'text/plain' });
    const token = new URL('http://x' + url).searchParams.get('token')!;
    expect(storage.verifyReadToken(token).respHeaders).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('verifyReadToken rejects an expired token', async () => {
    const url = await storage.getPreviewUrl('private', 'general/abc', -1, {});
    const token = new URL('http://x' + url).searchParams.get('token')!;
    expect(() => storage.verifyReadToken(token)).toThrow();
  });

  it('read rejects path traversal', () => {
    expect(() => storage.read('../../etc/passwd')).toThrow();
  });
});
