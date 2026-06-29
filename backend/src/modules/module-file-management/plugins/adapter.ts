import type { Readable } from 'node:stream';
import { resolve } from 'path';
import { Inject } from '@nestjs/common';
import env from 'src/utils/env';
import { FilePurpose, IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';

export const STORAGE_ADAPTER = Symbol.for('STORAGE_ADAPTER');
export const InjectStorageAdapter = () => Inject(STORAGE_ADAPTER);

export interface IObjectHint {
  mimetype?: string;
  hash?: string;
  size?: number;
}

export abstract class StorageAdapter {
  static readonly TEMPORARY_DIR = resolve(process.cwd(), '.temporary');

  static getBucket(purpose: FilePurpose): string {
    return purpose === FilePurpose.Public ? env.FILE_PUBLIC_BUCKET : env.FILE_PRIVATE_BUCKET;
  }

  static getDir(purpose: FilePurpose): string {
    return purpose;
  }

  static isPublicBucket(bucket: string): boolean {
    return bucket === env.FILE_PUBLIC_BUCKET;
  }

  abstract presigned(bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes>;
  abstract getObjectMeta(bucket: string, path: string, hint?: IObjectHint): Promise<IObjectMeta>;
  abstract getPreviewUrl(bucket: string, path: string, expiresIn?: number, respHeaders?: IRespHeaders): Promise<string>;
  abstract uploadFile(bucket: string, path: string, body: Buffer | Readable, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }>;
  abstract uploadFileWithPath(bucket: string, path: string, filePath: string, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }>;
  abstract cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string>;
  abstract downloadFile(bucket: string, path: string): Promise<Readable>;
  abstract deleteFile(bucket: string, path: string): Promise<void>;
  abstract deleteDir(bucket: string, path: string, throwError?: boolean): Promise<void>;
}
