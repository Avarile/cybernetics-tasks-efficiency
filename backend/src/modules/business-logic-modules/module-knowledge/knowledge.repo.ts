import { HttpStatus, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, SQL, getTableColumns } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  knowledge,
  knowledgeShare,
  knowledgeLink,
  knowledgeAttachment,
  taskKnowledge,
} from 'src/infra/application-db/schema/knowledge.schema';
import { AppException } from 'src/utils/exception.provider';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import {
  IKnowledgeEntity,
  IKnowledgeLink,
  INewKnowledge,
  IQueryKnowledgeParams,
  IUpdateKnowledge,
} from './knowledge.interface';

@Injectable()
export class KnowledgeRepository implements BaseRepo<IKnowledgeEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewKnowledge, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .insert(knowledge)
        .values({
          title: item.title,
          body: item.body ?? null,
          ownerPersonId: item.ownerPersonId,
          visibility: item.visibility ?? 'private',
        })
        .returning();
      return row as IKnowledgeEntity;
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<IKnowledgeEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(knowledge) })
        .from(knowledge)
        .where(and(eq(knowledge.id, Number(id)), eq(knowledge.isDeleted, false)));
      return (row as IKnowledgeEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IKnowledgeEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(knowledge) })
        .from(knowledge)
        .where(and(eq(knowledge.slug, slug), eq(knowledge.isDeleted, false)));
      return (row as IKnowledgeEntity) || null;
    });
  }

  async findByIds(ids: number[], ctx: IDBConfigOptions): Promise<IKnowledgeEntity[]> {
    if (!ids.length) return [];
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(knowledge) })
        .from(knowledge)
        .where(and(inArray(knowledge.id, ids), eq(knowledge.isDeleted, false)));
      return rows as IKnowledgeEntity[];
    });
  }

  async update(
    id: string | number,
    payload: IUpdateKnowledge,
    ctx: IDBConfigOptions,
  ): Promise<IKnowledgeEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: knowledge.id })
        .from(knowledge)
        .where(and(eq(knowledge.id, Number(id)), eq(knowledge.isDeleted, false)));
      if (!existing) AppException.notFound('Knowledge', id);
      // Strip immutable fields before applying the patch
      const {
        id: _i,
        slug: _s,
        createdAt: _c,
        updatedAt: _u,
        isDeleted: _d,
        deletedAt: _dt,
        ...rest
      } = payload as Record<string, unknown>;
      const [row] = await db
        .update(knowledge)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(knowledge.id, Number(id)))
        .returning();
      return row as IKnowledgeEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(knowledge)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(knowledge.id, Number(id)));
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db
        .select({ c: count() })
        .from(knowledge)
        .where(where ?? eq(knowledge.isDeleted, false));
      return Number(c);
    });
  }

  async query(params: IQueryKnowledgeParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const {
      title,
      ownerPersonId,
      visibility,
      requesterId,
      sharedIds,
      unrestricted,
      id,
      ids,
      slug,
      page = 1,
      pageSize = 50,
      isDeleted,
      sortOptions = [{ SortBy: 'createdAt', sortOrder: 'desc' }],
    } = params;

    const conditions: SQL[] = [eq(knowledge.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(knowledge.id, id));
    if (ids?.length) conditions.push(inArray(knowledge.id, ids));
    if (slug) conditions.push(eq(knowledge.slug, slug));
    if (title) conditions.push(ilike(knowledge.title, `%${title}%`));
    if (ownerPersonId) conditions.push(eq(knowledge.ownerPersonId, ownerPersonId));
    if (visibility) conditions.push(eq(knowledge.visibility, visibility));

    // Authorization-aware visibility scope (skipped when unrestricted, e.g. admin).
    if (!unrestricted && requesterId != null) {
      const scope: SQL[] = [
        eq(knowledge.ownerPersonId, requesterId),
        eq(knowledge.visibility, 'organization'),
      ];
      if (sharedIds?.length) scope.push(inArray(knowledge.id, sharedIds));
      conditions.push(or(...scope) as SQL);
    }

    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        id: knowledge.id as unknown as PgColumn,
        title: knowledge.title as unknown as PgColumn,
        createdAt: knowledge.createdAt as unknown as PgColumn,
        updatedAt: knowledge.updatedAt as unknown as PgColumn,
      };
      const order = sortOptions.map((o) => {
        const col = columnMap[o.SortBy] ?? columnMap.createdAt;
        return o.sortOrder === 'asc' ? asc(col) : desc(col);
      });
      const q = db
        .select({ ...getTableColumns(knowledge) })
        .from(knowledge)
        .where(where)
        .orderBy(...order)
        .$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as IKnowledgeEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Knowledge query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(params: IQueryKnowledgeParams, ctx: IDBConfigOptions): Promise<IKnowledgeEntity[]> {
    const res = await this.query(params, ctx);
    return res.data as IKnowledgeEntity[];
  }

  // --- shares ---------------------------------------------------------------

  async linkShare(knowledgeId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db
        .select({ id: knowledgeShare.id })
        .from(knowledgeShare)
        .where(
          and(
            eq(knowledgeShare.knowledgeId, knowledgeId),
            eq(knowledgeShare.personId, personId),
            eq(knowledgeShare.isDeleted, false),
          ),
        );
      if (existing.length > 0) return;
      await db.insert(knowledgeShare).values({ knowledgeId, personId });
    });
  }

  async unlinkShare(knowledgeId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(knowledgeShare)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(knowledgeShare.knowledgeId, knowledgeId),
            eq(knowledgeShare.personId, personId),
          ),
        );
    });
  }

  async findShareePersonIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ personId: knowledgeShare.personId })
        .from(knowledgeShare)
        .where(
          and(
            eq(knowledgeShare.knowledgeId, knowledgeId),
            eq(knowledgeShare.isDeleted, false),
          ),
        );
      return rows.map((r) => r.personId);
    });
  }

  async findSharedKnowledgeIdsForPerson(
    personId: number,
    ctx: IDBConfigOptions,
  ): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ knowledgeId: knowledgeShare.knowledgeId })
        .from(knowledgeShare)
        .where(
          and(
            eq(knowledgeShare.personId, personId),
            eq(knowledgeShare.isDeleted, false),
          ),
        );
      return rows.map((r) => r.knowledgeId);
    });
  }

  // --- links ----------------------------------------------------------------

  async addLink(
    knowledgeId: number,
    url: string,
    title: string | null,
    ctx: IDBConfigOptions,
  ): Promise<IKnowledgeLink> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .insert(knowledgeLink)
        .values({ knowledgeId, url, title: title ?? null })
        .returning();
      return {
        id: row.id,
        knowledgeId: row.knowledgeId,
        url: row.url,
        title: row.title ?? null,
      } as IKnowledgeLink;
    });
  }

  async removeLink(knowledgeId: number, linkId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(knowledgeLink)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(knowledgeLink.id, linkId), eq(knowledgeLink.knowledgeId, knowledgeId)),
        );
    });
  }

  async findLinks(knowledgeId: number, ctx: IDBConfigOptions): Promise<IKnowledgeLink[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({
          id: knowledgeLink.id,
          knowledgeId: knowledgeLink.knowledgeId,
          url: knowledgeLink.url,
          title: knowledgeLink.title,
        })
        .from(knowledgeLink)
        .where(
          and(
            eq(knowledgeLink.knowledgeId, knowledgeId),
            eq(knowledgeLink.isDeleted, false),
          ),
        );
      return rows.map((r) => ({ ...r, title: r.title ?? null })) as IKnowledgeLink[];
    });
  }

  // --- attachments ----------------------------------------------------------

  async linkAttachment(
    knowledgeId: number,
    attachmentId: number,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db
        .select({ id: knowledgeAttachment.id })
        .from(knowledgeAttachment)
        .where(
          and(
            eq(knowledgeAttachment.knowledgeId, knowledgeId),
            eq(knowledgeAttachment.attachmentId, attachmentId),
            eq(knowledgeAttachment.isDeleted, false),
          ),
        );
      if (existing.length > 0) return;
      await db.insert(knowledgeAttachment).values({ knowledgeId, attachmentId });
    });
  }

  async unlinkAttachment(
    knowledgeId: number,
    attachmentId: number,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(knowledgeAttachment)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(knowledgeAttachment.knowledgeId, knowledgeId),
            eq(knowledgeAttachment.attachmentId, attachmentId),
          ),
        );
    });
  }

  async findAttachmentIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ attachmentId: knowledgeAttachment.attachmentId })
        .from(knowledgeAttachment)
        .where(
          and(
            eq(knowledgeAttachment.knowledgeId, knowledgeId),
            eq(knowledgeAttachment.isDeleted, false),
          ),
        );
      return rows.map((r) => r.attachmentId);
    });
  }

  // --- task links -----------------------------------------------------------

  async linkTask(
    taskId: number,
    knowledgeId: number,
    attachedByPersonId: number,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db
        .select({ id: taskKnowledge.id })
        .from(taskKnowledge)
        .where(
          and(
            eq(taskKnowledge.taskId, taskId),
            eq(taskKnowledge.knowledgeId, knowledgeId),
            eq(taskKnowledge.isDeleted, false),
          ),
        );
      if (existing.length > 0) return;
      await db.insert(taskKnowledge).values({ taskId, knowledgeId, attachedByPersonId });
    });
  }

  async unlinkTask(taskId: number, knowledgeId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(taskKnowledge)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(taskKnowledge.taskId, taskId),
            eq(taskKnowledge.knowledgeId, knowledgeId),
          ),
        );
    });
  }

  async findTaskIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ taskId: taskKnowledge.taskId })
        .from(taskKnowledge)
        .where(
          and(
            eq(taskKnowledge.knowledgeId, knowledgeId),
            eq(taskKnowledge.isDeleted, false),
          ),
        );
      return rows.map((r) => r.taskId);
    });
  }

  async findKnowledgeIdsForTask(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ knowledgeId: taskKnowledge.knowledgeId })
        .from(taskKnowledge)
        .where(
          and(
            eq(taskKnowledge.taskId, taskId),
            eq(taskKnowledge.isDeleted, false),
          ),
        );
      return rows.map((r) => r.knowledgeId);
    });
  }
}
