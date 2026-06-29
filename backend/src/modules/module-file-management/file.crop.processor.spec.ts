import { FileCropProcessor } from './file.crop.processor';

const job = (data: any) => ({ data, queueName: 'file-crop', id: '1', name: 'crop_image', attemptsMade: 0 }) as any;

describe('FileCropProcessor', () => {
  let repo: any; let storage: any; let dbContext: any; let proc: FileCropProcessor;

  beforeEach(() => {
    repo = { findByToken: jest.fn(), setThumbnailPath: jest.fn() };
    storage = { cropImageThumbnails: jest.fn(async () => ({ sm: 's', lg: 'l' })) };
    dbContext = { forUser: jest.fn(() => ({ schema_id: 'public', user_id: 1 })) };
    proc = new FileCropProcessor(repo, storage, dbContext);
  });

  it('skips when the attachment already has a thumbnail', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: 'x' });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'image/png', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).not.toHaveBeenCalled();
  });

  it('crops images and persists thumbnailPath JSON', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: null });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'image/png', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).toHaveBeenCalledWith('private', 'p', 100);
    expect(repo.setThumbnailPath).toHaveBeenCalledWith('t', JSON.stringify({ sm: 's', lg: 'l' }), expect.anything());
  });

  it('no-ops on non-image types', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: null });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'application/pdf', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).not.toHaveBeenCalled();
    expect(repo.setThumbnailPath).not.toHaveBeenCalled();
  });
});
