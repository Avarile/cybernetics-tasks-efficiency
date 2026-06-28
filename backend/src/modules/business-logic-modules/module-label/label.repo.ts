import { HttpStatus, Injectable } from '@nestjs/common';
import { eq, and, ilike, inArray, desc, asc, count, SQL, getTableColumns } from 'drizzle-orm';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { label } from 'src/infra/application-db/schema/task.schema';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  INewLabel,
  IUpdateLabel,
  IQueryLabelParams,
  ILabelEntity,
} from './label.interface';

@Injectable()
export class LabelRepository implements BaseRepo<ILabelEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .insert(label)
        .values({
          name: item.name,
          description: item.description ?? null,
          color: item.color ?? null,
          parentId: item.parentId ?? null,
          sortOrder: item.sortOrder ?? 65535,
        })
        .returning();
      return row as ILabelEntity;
    });
  }

  async update(id: number, payload: IUpdateLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: label.id })
        .from(label)
        .where(and(eq(label.id, id), eq(label.isDeleted, false)));
      if (!existing) AppException.notFound('Label', id);

      const { id: _i, slug: _s, createdAt: _c, updatedAt: _u, isDeleted: _d, deletedAt: _dt, isActive: _a, ...rest } = payload as any;
      const [updated] = await db
        .update(label)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(label.id, id))
        .returning();
      return updated as ILabelEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(label)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(label.id, Number(id)));
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<ILabelEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(and(eq(label.id, Number(id)), eq(label.isDeleted, false)));
      return (row as ILabelEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<ILabelEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(and(eq(label.slug, slug), eq(label.isDeleted, false)));
      return (row as ILabelEntity) || null;
    });
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(eq(label.isDeleted, false))
        .orderBy(asc(label.sortOrder));
      return rows as ILabelEntity[];
    });
  }

  async query(searchParams: IQueryLabelParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const { name, id, ids, slug, page = 1, pageSize = 50, isDeleted } = searchParams as any;
    const conditions: SQL[] = [eq(label.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(label.id, id));
    if (ids?.length) conditions.push(inArray(label.id, ids));
    if (slug) conditions.push(eq(label.slug, slug));
    if (name) conditions.push(ilike(label.name, `%${name}%`));
    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const q = db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(where)
        .orderBy(desc(label.createdAt))
        .$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as ILabelEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Label query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(searchParams: IQueryLabelParams, ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    const res = await this.query(searchParams, ctx);
    return res.data as ILabelEntity[];
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db
        .select({ c: count() })
        .from(label)
        .where(where ?? eq(label.isDeleted, false));
      return Number(c);
    });
  }
}
