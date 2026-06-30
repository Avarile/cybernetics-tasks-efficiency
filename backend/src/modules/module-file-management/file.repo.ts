import { HttpStatus, Injectable } from '@nestjs/common';
import { and, count, desc, eq, getTableColumns, inArray, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { attachment } from 'src/infra/application-db/schema/file.schema';
import { AppException } from 'src/utils/exception.provider';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import {
  IAttachmentEntity, INewAttachment, IQueryAttachmentParams, IUpdateAttachment,
} from './file.interface';

@Injectable()
export class FileRepository implements BaseRepo<IAttachmentEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewAttachment, ctx: IDBConfigOptions): Promise<IAttachmentEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.insert(attachment).values({
        token: item.token,
        bucket: item.bucket,
        path: item.path,
        hash: item.hash,
        size: item.size,
        mimetype: item.mimetype,
        width: item.width ?? null,
        height: item.height ?? null,
        thumbnailPath: item.thumbnailPath ?? null,
        purpose: item.purpose,
        createdByPersonId: item.createdByPersonId,
      }).returning();
      return row as IAttachmentEntity;
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(and(eq(attachment.id, Number(id)), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(and(eq(attachment.slug, slug), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async findByToken(token: string, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(and(eq(attachment.token, token), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async findByIds(ids: number[], ctx: IDBConfigOptions): Promise<IAttachmentEntity[]> {
    if (!ids.length) return [];
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(and(inArray(attachment.id, ids), eq(attachment.isDeleted, false)));
      return rows as IAttachmentEntity[];
    });
  }

  async setThumbnailPath(
    token: string,
    thumbnailPath: string,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(attachment)
        .set({ thumbnailPath, updatedAt: new Date().toISOString() })
        .where(eq(attachment.token, token));
    }, executor);
  }

  async update(
    id: string | number,
    payload: IUpdateAttachment,
    ctx: IDBConfigOptions,
  ): Promise<IAttachmentEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: attachment.id })
        .from(attachment)
        .where(and(eq(attachment.id, Number(id)), eq(attachment.isDeleted, false)));
      if (!existing) AppException.notFound('Attachment', id);

      const { id: _i, slug: _s, createdAt: _c, ...rest } = payload as Record<string, unknown>;
      const [row] = await db
        .update(attachment)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(attachment.id, Number(id)))
        .returning();
      return row as IAttachmentEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(attachment)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(attachment.id, Number(id)));
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db
        .select({ c: count() })
        .from(attachment)
        .where(where ?? eq(attachment.isDeleted, false));
      return Number(c);
    });
  }

  async query(params: IQueryAttachmentParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const {
      token, hash, purpose, createdByPersonId, ids,
      page = 1, pageSize = 50,
    } = params;
    const conditions: SQL[] = [eq(attachment.isDeleted, false)];
    if (token) conditions.push(eq(attachment.token, token));
    if (hash) conditions.push(eq(attachment.hash, hash));
    if (purpose) conditions.push(eq(attachment.purpose, purpose));
    if (createdByPersonId) conditions.push(eq(attachment.createdByPersonId, createdByPersonId));
    if (ids?.length) conditions.push(inArray(attachment.id, ids));
    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        createdAt: attachment.createdAt as unknown as PgColumn,
        id: attachment.id as unknown as PgColumn,
      };
      const order = [desc(columnMap.createdAt)];
      const q = db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(where)
        .orderBy(...order)
        .$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as IAttachmentEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Attachment query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(params: IQueryAttachmentParams, ctx: IDBConfigOptions): Promise<IAttachmentEntity[]> {
    const res = await this.query(params, ctx);
    return res.data as IAttachmentEntity[];
  }
}
