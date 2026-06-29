const presignedUrl = jest.fn().mockResolvedValue('http://minio/upload');
const presignedGetObject = jest.fn().mockResolvedValue('http://minio/get');
const statObject = jest.fn().mockResolvedValue({ size: 7, etag: 'etag123', metaData: { 'content-type': 'text/plain' } });
const putObject = jest.fn().mockResolvedValue({ etag: 'etag123' });
const removeObject = jest.fn().mockResolvedValue(undefined);

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    presignedUrl, presignedGetObject, statObject, putObject, removeObject,
  })),
}));

import { MinioStorage } from './minio';

describe('MinioStorage', () => {
  // The minio.Client is mocked, so the constructor's env-derived args don't matter.
  beforeEach(() => jest.clearAllMocks());

  it('presigned builds a url and a token', async () => {
    const storage = new MinioStorage();
    const res = await storage.presigned('private', 'general', { contentType: 'text/plain', contentLength: 7 });
    expect(res.url).toBe('http://minio/upload');
    expect(res.token).toBeTruthy();
    expect(presignedUrl).toHaveBeenCalled();
  });

  it('getObjectMeta maps statObject (etag→hash) ignoring the hint', async () => {
    const storage = new MinioStorage();
    const meta = await storage.getObjectMeta('private', 'general/x');
    expect(meta).toMatchObject({ size: 7, hash: 'etag123', mimetype: 'text/plain' });
  });

  it('deleteFile uses removeObject', async () => {
    const storage = new MinioStorage();
    await storage.deleteFile('private', 'general/x');
    expect(removeObject).toHaveBeenCalledWith('private', 'general/x');
  });
});
