import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { createReadStream } from 'fs';
import { isAbsolute, resolve } from 'path';
import { AppException } from 'src/utils/exception.provider';

const IMAGE_RE = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|tiff)$/i;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const INLINE_PREVIEW = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf', 'text/plain',
]);

export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolveP, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveP(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function parseDurationSeconds(input: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (m) return Number(m[1]) * UNIT_SECONDS[m[2]];
  const n = Number(input);
  if (!Number.isNaN(n)) return n;
  AppException.throw('VALIDATION_FAILED', `Invalid duration: ${input}`);
}

export function isImage(mimetype: string): boolean {
  return IMAGE_RE.test(mimetype ?? '');
}

export function isPdf(mimetype: string): boolean {
  return (mimetype ?? '').toLowerCase() === 'application/pdf';
}

export function getExtensionPreview(mimetype: string): string {
  return INLINE_PREVIEW.has((mimetype ?? '').toLowerCase()) ? mimetype : 'application/octet-stream';
}

export function assertPathWithinStorage(relativePath: string, storageDir: string): string {
  if (!relativePath || !storageDir || relativePath.includes('..') || isAbsolute(relativePath)) {
    AppException.throw('FILE_TOKEN_INVALID', 'Invalid file path');
  }
  const resolved = resolve(storageDir, relativePath);
  if (!resolved.startsWith(storageDir + '/')) {
    AppException.throw('FILE_TOKEN_INVALID', 'Invalid file path');
  }
  return resolved;
}

export interface ILocalReadToken {
  expiresDate: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  respHeaders?: Record<string, any>;
}

export class TokenCipher {
  private readonly key: Buffer;
  constructor(secret: string) {
    this.key = scryptSync(secret, 'cyb-file-token', 32);
  }
  encrypt(payload: ILocalReadToken): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, data]).toString('base64url');
  }
  decrypt(token: string): ILocalReadToken {
    const raw = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const out = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(out.toString('utf8')) as ILocalReadToken;
  }
}
