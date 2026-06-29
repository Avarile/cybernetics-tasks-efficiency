import type { Readable } from 'node:stream';
import { join, resolve } from 'path';
import * as minio from 'minio';
import * as fse from 'fs-extra';
// sharp v0.35 is a dual-package whose default-resolved types are a non-callable
// namespace under this repo's tsconfig (moduleResolution:node, esModuleInterop:false);
// target the CJS declaration (callable `export =`) and load via require for CJS runtime.
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { parseDurationSeconds, randomToken, isImage } from '../file.util';
import { IObjectHint, StorageAdapter } from './adapter';
import { IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';

export class MinioStorage extends StorageAdapter {
  private readonly client: minio.Client;
  private readonly internal: minio.Client;

  constructor() {
    super();
    this.client = new minio.Client({
      endPoint: env.MINIO_ENDPOINT as string,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY as string,
      secretKey: env.MINIO_SECRET_KEY as string,
      region: env.MINIO_REGION,
    });
    this.internal = env.MINIO_INTERNAL_ENDPOINT
      ? new minio.Client({
          endPoint: env.MINIO_INTERNAL_ENDPOINT,
          port: env.MINIO_INTERNAL_PORT,
          useSSL: false,
          accessKey: env.MINIO_ACCESS_KEY as string,
          secretKey: env.MINIO_SECRET_KEY as string,
          region: env.MINIO_REGION,
        })
      : this.client;
    fse.ensureDirSync(StorageAdapter.TEMPORARY_DIR);
  }

  async presigned(bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes> {
    const token = randomToken();
    const path = join(dir, params.hash ?? token);
    const requestHeaders = {
      'Content-Type': params.contentType,
      'Content-Length': String(params.contentLength),
      'response-cache-control': 'max-age=31536000, immutable',
    };
    const expiry = params.expiresIn ?? parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN);
    try {
      const client = params.internal ? this.internal : this.client;
      const url = await client.presignedUrl(env.FILE_UPLOAD_METHOD, bucket, path, expiry, requestHeaders);
      return { url, path, token, uploadMethod: env.FILE_UPLOAD_METHOD, requestHeaders };
    } catch (e) {
      AppException.throw('STORAGE_OPERATION_FAILED', e instanceof Error ? e.message : 'presign failed');
    }
  }

  async getObjectMeta(bucket: string, path: string, _hint?: IObjectHint): Promise<IObjectMeta> {
    try {
      const { size, etag: hash, metaData } = await this.internal.statObject(bucket, path);
      const mimetype = metaData['content-type'] as string;
      const url = `/${bucket}/${path}`;
      if (!isImage(mimetype ?? '')) return { hash, size, mimetype, url };
      return { ...(await this.getShape(bucket, path)), hash, size, mimetype, url };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.code === 'NoSuchKey' || e?.code === 'NotFound') {
        AppException.throw('FILE_TOKEN_INVALID', 'Uploaded object not found');
      }
      AppException.throw('STORAGE_OPERATION_FAILED', e instanceof Error ? e.message : 'getObjectMeta failed');
    }
  }

  private async getShape(bucket: string, path: string): Promise<{ width?: number; height?: number }> {
    let stream: Readable | undefined;
    try {
      stream = await this.internal.getObject(bucket, path);
      const { width, height } = await stream.pipe(sharp()).metadata();
      return { width, height };
    } catch {
      return {};
    } finally {
      stream?.removeAllListeners();
      stream?.destroy();
    }
  }

  async getPreviewUrl(bucket: string, path: string, expiresIn?: number, respHeaders?: IRespHeaders): Promise<string> {
    const expiry = expiresIn ?? parseDurationSeconds(env.FILE_URL_EXPIRE_IN);
    const { 'Content-Disposition': disposition, ...rest } = respHeaders ?? {};
    return this.client.presignedGetObject(bucket, path, expiry, {
      ...rest,
      'response-content-disposition': disposition,
    });
  }

  async uploadFile(bucket: string, path: string, body: Buffer | Readable, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }> {
    const { etag: hash } = await this.internal.putObject(bucket, path, body as never, undefined, metadata as never);
    return { hash, path };
  }

  async uploadFileWithPath(bucket: string, path: string, filePath: string, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }> {
    const { etag: hash } = await this.internal.fPutObject(bucket, path, filePath, metadata as never);
    return { hash, path };
  }

  async cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string> {
    const out = newPath || `${path}_${width ?? 0}_${height ?? 0}`;
    const source = resolve(StorageAdapter.TEMPORARY_DIR, encodeURIComponent(path));
    const resized = resolve(StorageAdapter.TEMPORARY_DIR, encodeURIComponent(join(bucket, out)));
    const stream = await this.internal.getObject(bucket, path);
    await new Promise<void>((resolveP, reject) => {
      const writer = fse.createWriteStream(source);
      stream.pipe(writer);
      stream.on('error', reject);
      writer.on('finish', resolveP);
      writer.on('error', reject);
    });
    await sharp(source, { failOn: 'none', unlimited: true }).resize(width, height).toFile(resized);
    await this.uploadFileWithPath(bucket, out, resized);
    fse.removeSync(source);
    fse.removeSync(resized);
    return out;
  }

  async downloadFile(bucket: string, path: string): Promise<Readable> {
    return this.internal.getObject(bucket, path);
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.internal.removeObject(bucket, path);
  }

  async deleteDir(bucket: string, path: string, throwError = true): Promise<void> {
    try {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const names: string[] = [];
      const stream = this.internal.listObjects(bucket, prefix, true);
      await new Promise<void>((resolveP, reject) => {
        stream.on('data', (o) => o.name && names.push(o.name));
        stream.on('end', () => resolveP());
        stream.on('error', reject);
      });
      if (names.length) await this.internal.removeObjects(bucket, names);
    } catch (err) {
      if (!throwError) return;
      AppException.throw('STORAGE_OPERATION_FAILED', err instanceof Error ? err.message : 'deleteDir failed');
    }
  }
}
