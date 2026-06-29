import { createWriteStream, existsSync, rmSync, unlinkSync } from 'fs';
import type { Readable } from 'node:stream';
import { join, resolve } from 'path';
import type { Request } from 'express';
import * as fse from 'fs-extra';
// sharp uses `export =` in CJS; with moduleResolution:node the ESM types land,
// so we reference the CTS declaration directly for callable typing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { IObjectHint, StorageAdapter } from './adapter';
import { IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';
import { assertPathWithinStorage, ILocalReadToken, isImage, randomToken, sha256File, TokenCipher } from '../file.util';

export interface ILocalFileUpload {
  path: string;
  size: number;
  mimetype: string;
}

const READ_PREFIX = '/api/files/read';
const UPLOAD_PREFIX = '/api/files/upload';

export class LocalStorage extends StorageAdapter {
  readonly storageDir: string;
  private readonly cipher: TokenCipher;

  // storageDir/tokenSecret are injectable so tests stay hermetic; production
  // construction (the DI factory) passes nothing and falls back to env.
  constructor(storageDir?: string, tokenSecret?: string) {
    super();
    this.storageDir = storageDir ?? resolve(process.cwd(), env.FILE_LOCAL_PATH);
    this.cipher = new TokenCipher(tokenSecret ?? env.FILE_TOKEN_SECRET);
    fse.ensureDirSync(StorageAdapter.TEMPORARY_DIR);
    fse.ensureDirSync(this.storageDir);
  }

  async presigned(_bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes> {
    const token = randomToken();
    const filename = params.hash ?? token;
    const path = join(dir, filename);
    const baseUrl = params.internal ? `http://localhost:${env.PORT}` : '';
    return {
      token,
      path,
      url: `${baseUrl}${UPLOAD_PREFIX}/${token}`,
      uploadMethod: env.FILE_UPLOAD_METHOD,
      requestHeaders: { 'Content-Type': params.contentType, 'Content-Length': params.contentLength },
    };
  }

  async saveTemporaryFile(req: Request): Promise<ILocalFileUpload> {
    const name = randomToken();
    const path = resolve(StorageAdapter.TEMPORARY_DIR, name);
    let size = 0;
    return new Promise<ILocalFileUpload>((resolveP, reject) => {
      const fileStream = createWriteStream(path);
      req.on('data', (chunk) => {
        fileStream.write(chunk);
        size += chunk.length;
      });
      req.on('end', () => fileStream.end());
      req.on('error', (err) => {
        fileStream.end();
        reject(err);
      });
      fileStream.on('error', reject);
      fileStream.on('finish', () =>
        resolveP({ size, mimetype: req.headers['content-type'] as string, path }),
      );
    });
  }

  validateUpload(file: ILocalFileUpload, expected: { contentLength?: number; contentType?: string }): void {
    if (expected.contentLength != null && expected.contentLength !== file.size) {
      AppException.throw('FILE_TOKEN_INVALID', 'Upload size mismatch');
    }
    if (expected.contentType && file.mimetype && expected.contentType !== file.mimetype) {
      AppException.throw('FILE_TYPE_REJECTED', `Not allowed to upload ${file.mimetype}`);
    }
  }

  async save(tempPath: string, relPath: string): Promise<string> {
    const dest = resolve(this.storageDir, relPath);
    await fse.ensureDir(resolve(dest, '..'));
    await fse.copy(tempPath, dest);
    this.deleteLocal(tempPath);
    return relPath;
  }

  read(relPath: string): Readable {
    return fse.createReadStream(resolve(this.storageDir, relPath));
  }

  getLastModifiedTime(relPath: string): number | undefined {
    const full = resolve(this.storageDir, relPath);
    return existsSync(full) ? fse.statSync(full).mtimeMs : undefined;
  }

  parsePath(path: string): { bucket: string; token: string } {
    const parts = path.split('/');
    return { bucket: parts[0], token: parts[parts.length - 1] };
  }

  private buildReadUrl(bucket: string, path: string, payload: ILocalReadToken): string {
    const token = this.cipher.encrypt(payload);
    const disposition = payload.respHeaders?.['Content-Disposition'];
    const suffix = disposition ? `&response-content-disposition=${encodeURIComponent(disposition)}` : '';
    return `${READ_PREFIX}/${join(bucket, path)}?token=${token}${suffix}`;
  }

  verifyReadToken(token: string): { respHeaders?: IRespHeaders } {
    let payload: ILocalReadToken;
    try {
      payload = this.cipher.decrypt(token);
    } catch {
      AppException.throw('FILE_TOKEN_INVALID', 'Invalid read token');
    }
    if (payload.expiresDate > 0 && Math.floor(Date.now() / 1000) > payload.expiresDate) {
      AppException.throw('FILE_TOKEN_INVALID', 'Read token expired');
    }
    return { respHeaders: payload.respHeaders };
  }

  async getObjectMeta(bucket: string, path: string, hint?: IObjectHint): Promise<IObjectMeta> {
    if (!hint?.mimetype || hint.hash == null || hint.size == null) {
      AppException.throw('STORAGE_OPERATION_FAILED', 'Local getObjectMeta requires upload hint');
    }
    const meta: IObjectMeta = {
      hash: hint.hash,
      size: hint.size,
      mimetype: hint.mimetype,
      url: this.buildReadUrl(bucket, path, { expiresDate: -1, respHeaders: { 'Content-Type': hint.mimetype } }),
    };
    if (!isImage(hint.mimetype)) return meta;
    try {
      const { width, height } = await sharp(resolve(this.storageDir, bucket, path)).metadata();
      return { ...meta, width, height };
    } catch {
      return meta;
    }
  }

  async getPreviewUrl(bucket: string, path: string, expiresIn = 0, respHeaders?: IRespHeaders): Promise<string> {
    return this.buildReadUrl(bucket, path, {
      expiresDate: Math.floor(Date.now() / 1000) + expiresIn,
      respHeaders,
    });
  }

  async uploadFile(bucket: string, path: string, body: Buffer | Readable, _metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }> {
    const temp = resolve(StorageAdapter.TEMPORARY_DIR, randomToken());
    if (Buffer.isBuffer(body)) {
      await fse.writeFile(temp, body);
    } else {
      await new Promise<void>((resolveP, reject) => {
        const writer = createWriteStream(temp);
        body.pipe(writer);
        body.on('error', reject);
        writer.on('finish', resolveP);
        writer.on('error', reject);
      });
    }
    const hash = await sha256File(temp);
    await this.save(temp, join(bucket, path));
    return { hash, path };
  }

  async uploadFileWithPath(bucket: string, path: string, filePath: string): Promise<{ hash: string; path: string }> {
    const hash = await sha256File(filePath);
    const dest = resolve(this.storageDir, bucket, path);
    await fse.ensureDir(resolve(dest, '..'));
    await fse.copy(filePath, dest);
    return { hash, path };
  }

  async cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string> {
    const out = newPath || `${path}_${width ?? 0}_${height ?? 0}`;
    const outFull = resolve(this.storageDir, bucket, out);
    if (existsSync(outFull)) return out;
    const image = sharp(resolve(this.storageDir, bucket, path), { failOn: 'none', unlimited: true });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      AppException.throw('STORAGE_OPERATION_FAILED', 'Invalid image for crop');
    }
    await fse.ensureDir(resolve(outFull, '..'));
    await image.resize(width, height).toFile(outFull);
    return out;
  }

  async downloadFile(bucket: string, path: string): Promise<Readable> {
    return fse.createReadStream(resolve(this.storageDir, bucket, path));
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    this.deleteLocal(resolve(this.storageDir, bucket, path));
  }

  async deleteDir(bucket: string, path: string, throwError = true): Promise<void> {
    const dir = resolve(this.storageDir, bucket, path);
    try {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      if (!throwError) return;
      throw err;
    }
  }

  private deleteLocal(filePath: string): void {
    try {
      unlinkSync(filePath);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code !== 'ENOENT') throw err;
    }
  }
}
