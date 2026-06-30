import type { IncomingHttpHeaders } from 'http';
import type { Request, Response } from 'express';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from 'cache-manager';
import { Queue } from 'bullmq';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { assertAbility } from 'src/common/casl/assert-ability';
import { AppAbility } from 'src/common/casl/ability.types';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { DbContextService } from 'src/infra/application-db/db-context';
import { FILE_CROP_JOB, QueueName } from 'src/infra/queue/queue.constants';
import { FileRepository } from './file.repo';
import { FileStorageService } from './file.storage.service';
import { InjectStorageAdapter, StorageAdapter } from './plugins/adapter';
import { LocalStorage } from './plugins/local';
import { getExtensionPreview, parseDurationSeconds } from './file.util';
import { FilePurpose, IAttachmentEntity, INotifyResult, IPresignRes } from './file.interface';

interface ISignatureInput {
  purpose: FilePurpose;
  contentType: string;
  contentLength: number;
  hash?: string;
  internal?: boolean;
}

@Injectable()
export class FileService {
  constructor(
    private readonly repo: FileRepository,
    private readonly storage: FileStorageService,
    @InjectStorageAdapter() private readonly adapter: StorageAdapter,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(QueueName.FILE_CROP) private readonly cropQueue: Queue,
    private readonly dbContext: DbContextService,
  ) {}

  async signature(input: ISignatureInput, ctx: IDBConfigOptions): Promise<IPresignRes> {
    if (input.contentLength > env.FILE_MAX_UPLOAD_SIZE) {
      AppException.throw('FILE_TOO_LARGE', `Max upload size is ${env.FILE_MAX_UPLOAD_SIZE} bytes`);
    }
    const bucket = StorageAdapter.getBucket(input.purpose);
    const dir = StorageAdapter.getDir(input.purpose);
    const res = await this.adapter.presigned(bucket, dir, {
      contentType: input.contentType,
      contentLength: input.contentLength,
      hash: input.hash,
      internal: input.internal,
    });
    const ttl = parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN) * 1000;
    await this.cache.set(
      cacheKey.fileSig(ctx.schema_id, res.token),
      { path: res.path, bucket, hash: input.hash, purpose: input.purpose },
      ttl,
    );
    if (env.FILE_STORAGE_PROVIDER === 'local') {
      await this.cache.set(
        cacheKey.fileLocalSig(ctx.schema_id, res.token),
        { contentLength: input.contentLength, contentType: input.contentType },
        ttl,
      );
    }
    return res;
  }

  async uploadLocal(req: Request, token: string): Promise<void> {
    const ctx = this.dbContext.system();
    const sig = await this.cache.get<{ path: string; bucket: string }>(cacheKey.fileSig(ctx.schema_id, token));
    if (!sig) AppException.throw('FILE_TOKEN_INVALID', 'Unknown upload token');
    const local = this.adapter as LocalStorage;
    const file = await local.saveTemporaryFile(req);
    const expected = await this.cache.get<{ contentLength?: number; contentType?: string }>(
      cacheKey.fileLocalSig(ctx.schema_id, token),
    );
    local.validateUpload(file, expected ?? {});
    const { hash } = await local.uploadFileWithPath(sig.bucket, sig.path, file.path);
    await this.cache.set(
      cacheKey.fileUpload(ctx.schema_id, token),
      { mimetype: file.mimetype, hash, size: file.size },
      parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN) * 1000,
    );
  }

  async notify(token: string, ctx: IDBConfigOptions, filename?: string): Promise<INotifyResult> {
    const existing = await this.repo.findByToken(token, ctx);
    if (existing) {
      // Idempotent: a prior notify already persisted this token (retry / double-submit).
      const dispositionHeader = filename
        ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }
        : {};
      const presignedUrl = await this.storage.getPreviewUrlByPath(
        ctx.schema_id, existing.bucket, existing.path, existing.token, undefined,
        { 'Content-Type': existing.mimetype, ...dispositionHeader },
      );
      return {
        token: existing.token, slug: existing.slug, path: existing.path,
        size: existing.size, mimetype: existing.mimetype,
        width: existing.width, height: existing.height,
        url: presignedUrl, presignedUrl,
      };
    }
    const sig = await this.cache.get<{ path: string; bucket: string; purpose: FilePurpose }>(
      cacheKey.fileSig(ctx.schema_id, token),
    );
    if (!sig) AppException.throw('FILE_TOKEN_INVALID', 'Unknown token');
    const hint =
      env.FILE_STORAGE_PROVIDER === 'local'
        ? await this.cache.get<{ mimetype: string; hash: string; size: number }>(cacheKey.fileUpload(ctx.schema_id, token))
        : undefined;
    if (env.FILE_STORAGE_PROVIDER === 'local' && !hint) {
      AppException.throw('FILE_TOKEN_INVALID', 'Upload not completed');
    }
    const meta = await this.adapter.getObjectMeta(sig.bucket, sig.path, hint);
    const row = await this.repo.create(
      {
        token,
        bucket: sig.bucket,
        path: sig.path,
        hash: meta.hash,
        size: meta.size,
        mimetype: meta.mimetype,
        width: meta.width ?? null,
        height: meta.height ?? null,
        purpose: sig.purpose,
        createdByPersonId: ctx.user_id,
      },
      ctx,
    );
    await this.cropQueue.add(FILE_CROP_JOB, {
      bucket: sig.bucket,
      token,
      path: sig.path,
      mimetype: meta.mimetype,
      height: meta.height ?? null,
      userId: ctx.user_id,
    });
    const filenameHeader = filename
      ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }
      : {};
    const presignedUrl = await this.storage.getPreviewUrlByPath(
      ctx.schema_id, sig.bucket, sig.path, token, undefined,
      { 'Content-Type': meta.mimetype, ...filenameHeader },
    );
    return {
      token, slug: row.slug, path: sig.path, size: meta.size, mimetype: meta.mimetype,
      width: meta.width ?? null, height: meta.height ?? null, url: meta.url, presignedUrl,
    };
  }

  async readLocalFile(path: string, token?: string): Promise<{ fileStream: NodeJS.ReadableStream; headers: Record<string, string> }> {
    const local = this.adapter as LocalStorage;
    const { bucket, token: pathToken } = local.parsePath(path);
    let headers: Record<string, string> = {};
    if (token && !StorageAdapter.isPublicBucket(bucket)) {
      headers = (local.verifyReadToken(token).respHeaders as Record<string, string>) ?? {};
    } else {
      const att = await this.repo.findByToken(pathToken, this.dbContext.system());
      if (!att) AppException.throw('FILE_TOKEN_INVALID', 'Invalid path');
      headers['Content-Type'] = getExtensionPreview(att.mimetype);
    }
    headers['Cross-Origin-Resource-Policy'] = 'unsafe-none';
    return { fileStream: local.read(path), headers };
  }

  localConditionalCaching(path: string, reqHeaders: IncomingHttpHeaders, res: Response): boolean {
    const local = this.adapter as LocalStorage;
    const lastModified = local.getLastModifiedTime(path);
    if (!lastModified) AppException.notFound('Attachment', path);
    const ifModifiedSince = reqHeaders['if-modified-since'];
    if (!ifModifiedSince || Math.floor(new Date(ifModifiedSince).getTime() / 1000) < Math.floor(lastModified / 1000)) {
      res.set('Last-Modified', new Date(lastModified).toUTCString());
      return false;
    }
    return true;
  }

  async requireBySlugAuthorized(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<IAttachmentEntity> {
    const row = await this.repo.findBySlug(slug, ctx);
    if (!row) AppException.notFound('Attachment', slug);
    assertAbility(ability, 'read', 'Attachment', row!, 'You cannot view this attachment');
    return row!;
  }

  /**
   * Resolve attachment ids to preview URLs WITHOUT a per-attachment CASL check.
   * The caller (person/knowledge service) has already authorized access at its
   * own level, so re-checking the owner-only `read Attachment` rule here would
   * wrongly reject teammates who can see a shared note but did not upload it.
   */
  async getLinkByIds(
    ids: number[],
    ctx: IDBConfigOptions,
  ): Promise<Array<{ id: number; slug: string; url: string; mimetype: string; thumbnailPath: string | null }>> {
    const rows = await this.repo.findByIds(ids, ctx);
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        slug: r.slug,
        mimetype: r.mimetype,
        thumbnailPath: r.thumbnailPath,
        url: await this.storage.getPreviewUrlByPath(
          ctx.schema_id, r.bucket, r.path, r.token, undefined, { 'Content-Type': r.mimetype },
        ),
      })),
    );
  }

  async getLink(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<string> {
    const row = await this.requireBySlugAuthorized(slug, ctx, ability);
    return this.storage.getPreviewUrlByPath(ctx.schema_id, row.bucket, row.path, row.token, undefined, {
      'Content-Type': row.mimetype,
    });
  }

  async remove(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const row = await this.repo.findBySlug(slug, ctx);
    if (!row) AppException.notFound('Attachment', slug);
    assertAbility(ability, 'delete', 'Attachment', row!, 'You cannot delete this attachment');
    await this.adapter.deleteFile(row!.bucket, row!.path);
    await this.repo.delete(row!.id, ctx);
  }
}
