import {
  randomToken, sha256Buffer, parseDurationSeconds, isImage, isPdf,
  getExtensionPreview, assertPathWithinStorage, TokenCipher,
} from './file.util';

describe('file.util', () => {
  it('sha256Buffer hashes a known vector', () => {
    expect(sha256Buffer(Buffer.from(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('parseDurationSeconds parses units and raw seconds', () => {
    expect(parseDurationSeconds('6d')).toBe(518400);
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('90')).toBe(90);
  });

  it('isImage / isPdf classify mimetypes', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage('text/plain')).toBe(false);
    expect(isPdf('application/pdf')).toBe(true);
  });

  it('getExtensionPreview only allows safe inline types', () => {
    expect(getExtensionPreview('image/png')).toBe('image/png');
    expect(getExtensionPreview('text/html')).toBe('application/octet-stream');
  });

  it('randomToken returns url-safe tokens', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('TokenCipher round-trips a payload', () => {
    const cipher = new TokenCipher('test-secret');
    const token = cipher.encrypt({ expiresDate: 123, respHeaders: { 'Content-Type': 'image/png' } });
    expect(cipher.decrypt(token)).toEqual({ expiresDate: 123, respHeaders: { 'Content-Type': 'image/png' } });
  });

  it('TokenCipher.decrypt rejects a tampered token as FILE_TOKEN_INVALID', () => {
    const cipher = new TokenCipher('test-secret');
    expect(() => cipher.decrypt('not-a-valid-token')).toThrow('Invalid or expired file token');
  });

  it('assertPathWithinStorage rejects traversal and absolute paths', () => {
    expect(() => assertPathWithinStorage('../escape', '/srv/store')).toThrow();
    expect(() => assertPathWithinStorage('/etc/passwd', '/srv/store')).toThrow();
    expect(assertPathWithinStorage('private/general/abc', '/srv/store')).toBe('/srv/store/private/general/abc');
  });
});
