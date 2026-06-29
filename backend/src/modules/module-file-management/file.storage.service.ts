import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
// sharp v0.35 is a dual-package whose default-resolved types are a non-callable
// namespace under this repo's tsconfig (moduleResolution:node, esModuleInterop:false);
// target the CJS declaration (callable `export =`) and load via require for CJS runtime.
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { InjectStorageAdapter, StorageAdapter } from './plugins/adapter';
import { parseDurationSeconds } from './file.util';
import { IRespHeaders } from './file.interface';

export const THUMB_SM = 56;
export const THUMB_LG = 525;
const THUMB_MIMETYPE = 'image/png';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectStorageAdapter() private readonly adapter: StorageAdapter,
  ) {}

  async getPreviewUrlByPath(
    schema: string,
    bucket: string,
    path: string,
    token: string,
    expiresIn?: number,
    respHeaders?: IRespHeaders,
  ): Promise<string> {
    const expiry = expiresIn ?? parseDurationSeconds(env.FILE_URL_EXPIRE_IN);
    const key = cacheKey.filePreview(schema, token);
    const cached = await this.cache.get<{ url: string }>(key);
    if (cached?.url) return cached.url;
    const url = await this.adapter.getPreviewUrl(bucket, path, expiry, respHeaders);
    await this.cache.set(key, { url }, Math.floor(expiry * 0.5) * 1000);
    return url;
  }

  async cropImageThumbnails(bucket: string, path: string): Promise<{ sm?: string; lg?: string }>;
  async cropImageThumbnails(bucket: string, path: string, height: number): Promise<{ sm?: string; lg?: string }>;
  async cropImageThumbnails(bucket: string, path: string, height = Infinity): Promise<{ sm?: string; lg?: string }> {
    const sm = height > THUMB_SM ? await this.adapter.cropImage(bucket, path, undefined, THUMB_SM, `${path}_sm`) : undefined;
    const lg = height > THUMB_LG ? await this.adapter.cropImage(bucket, path, undefined, THUMB_LG, `${path}_lg`) : undefined;
    return { sm, lg };
  }

  async uploadThumbnailsFromBuffer(
    bucket: string,
    path: string,
    buffer: Buffer,
    height: number,
  ): Promise<{ sm?: string; lg?: string }> {
    const image = sharp(buffer, { failOn: 'none', unlimited: true });
    let sm: string | undefined;
    let lg: string | undefined;
    if (height > THUMB_SM) {
      const buf = await image.clone().resize(undefined, THUMB_SM).png().toBuffer();
      sm = (await this.adapter.uploadFile(bucket, `${path}_sm`, buf, { 'Content-Type': THUMB_MIMETYPE })).path;
    }
    if (height > THUMB_LG) {
      const buf = await image.clone().resize(undefined, THUMB_LG).png().toBuffer();
      lg = (await this.adapter.uploadFile(bucket, `${path}_lg`, buf, { 'Content-Type': THUMB_MIMETYPE })).path;
    }
    return { sm, lg };
  }
}
