import { StorageAdapter } from './adapter';
import { FilePurpose } from '../file.interface';

describe('StorageAdapter routing', () => {
  it('routes general → private bucket, public → public bucket', () => {
    expect(StorageAdapter.getBucket(FilePurpose.General)).toBe('private');
    expect(StorageAdapter.getBucket(FilePurpose.Public)).toBe('public');
  });

  it('getDir mirrors the purpose value', () => {
    expect(StorageAdapter.getDir(FilePurpose.General)).toBe('general');
  });

  it('isPublicBucket recognises the public bucket', () => {
    expect(StorageAdapter.isPublicBucket('public')).toBe(true);
    expect(StorageAdapter.isPublicBucket('private')).toBe(false);
  });
});
