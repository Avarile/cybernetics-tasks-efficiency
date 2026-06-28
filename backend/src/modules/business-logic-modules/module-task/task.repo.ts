import { HttpStatus, Injectable } from '@nestjs/common';
import { eq, and, ilike, inArray, desc, asc, count, SQL, getTableColumns } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { task, taskAssignee, taskLabel } from 'src/infra/application-db/schema/task.schema';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  INewTask, IUpdateTask, IQueryTaskParams, ITaskEntity, ITaskSummary, TaskStatus,
} from './task.interface';

const ALL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'blocked', 'paused', 'completed', 'cancelled'];

@Injectable()
export class TaskRepository implements BaseRepo<ITaskEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      // sequenceId is intentionally omitted — the DB DEFAULT nextval(...) assigns it.
      const [row] = await db
        .insert(task)
        .values({
          initiativeId: item.initiativeId,
          parentId: item.parentId ?? null,
          title: item.title,
          description: item.description ?? null,
          priority: item.priority,
          startDate: item.startDate ?? null,
          targetDate: item.targetDate ?? null,
          createdByPersonId: item.createdByPersonId,
          status: 'not_started',
        })
        .returning();
      return row as ITaskEntity;
    });
  }

  async updateStatus(
    taskId: number,
    status: TaskStatus,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        await db
          .update(task)
          .set({ status, updatedAt: new Date().toISOString() })
          .where(eq(task.id, taskId));
      },
      executor,
    );
  }

  async update(id: number, payload: IUpdateTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: task.id })
        .from(task)
        .where(and(eq(task.id, id), eq(task.isDeleted, false)));
      if (!existing) AppException.notFound('Task', id);

      const { id: _i, slug: _s, createdAt: _c, sequenceId: _seq, status: _st, updatedAt: _u, isDeleted: _d, deletedAt: _dt, isActive: _a, ...rest } = payload as any;
      const [updated] = await db
        .update(task)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(task.id, id))
        .returning();
      return updated as ITaskEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(task)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(task.id, Number(id)));
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<ITaskEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.id, Number(id)), eq(task.isDeleted, false)));
      return (row as ITaskEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<ITaskEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.slug, slug), eq(task.isDeleted, false)));
      return (row as ITaskEntity) || null;
    });
  }

  async findChildren(parentId: number, ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.parentId, parentId), eq(task.isDeleted, false)))
        .orderBy(asc(task.sortOrder));
      return rows as ITaskEntity[];
    });
  }

  async countByInitiative(initiativeId: number, ctx: IDBConfigOptions): Promise<ITaskSummary> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ status: task.status, c: count() })
        .from(task)
        .where(and(eq(task.initiativeId, initiativeId), eq(task.isDeleted, false)))
        .groupBy(task.status);
      const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
      let total = 0;
      for (const r of rows) {
        byStatus[r.status as TaskStatus] = Number(r.c);
        total += Number(r.c);
      }
      return { total, byStatus };
    });
  }

  async query(searchParams: IQueryTaskParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const { title, initiativeId, parentId, priority, status, id, ids, slug, page = 1, pageSize = 50, isDeleted,
      sortOptions = [{ SortBy: 'sortOrder', sortOrder: 'asc' }, { SortBy: 'createdAt', sortOrder: 'desc' }] } = searchParams;

    const conditions: SQL[] = [eq(task.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(task.id, id));
    if (ids?.length) conditions.push(inArray(task.id, ids));
    if (slug) conditions.push(eq(task.slug, slug));
    if (title) conditions.push(ilike(task.title, `%${title}%`));
    if (initiativeId) conditions.push(eq(task.initiativeId, initiativeId));
    if (parentId) conditions.push(eq(task.parentId, parentId));
    if (priority) conditions.push(eq(task.priority, priority));
    if (status) conditions.push(eq(task.status, status));
    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        id: task.id as unknown as PgColumn,
        title: task.title as unknown as PgColumn,
        sortOrder: task.sortOrder as unknown as PgColumn,
        createdAt: task.createdAt as unknown as PgColumn,
        updatedAt: task.updatedAt as unknown as PgColumn,
      };
      const order = sortOptions.map((o) => {
        const col = columnMap[o.SortBy] ?? columnMap.createdAt;
        return o.sortOrder === 'asc' ? asc(col) : desc(col);
      });
      const q = db.select({ ...getTableColumns(task) }).from(task).where(where).orderBy(...order).$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as ITaskEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Task query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(searchParams: IQueryTaskParams, ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    const res = await this.query(searchParams, ctx);
    return res.data as ITaskEntity[];
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(eq(task.isDeleted, false))
        .orderBy(desc(task.createdAt));
      return rows as ITaskEntity[];
    });
  }

  async existByID(id: number, ctx: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(task).where(and(eq(task.id, id), eq(task.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(task).where(where ?? eq(task.isDeleted, false));
      return Number(c);
    });
  }

  // --- assignees -----------------------------------------------------------
  async linkAssignee(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: taskAssignee.id }).from(taskAssignee)
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.personId, personId), eq(taskAssignee.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(taskAssignee).values({ taskId, personId });
    });
  }

  async unlinkAssignee(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(taskAssignee)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.personId, personId)));
    });
  }

  async findAssigneeIds(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ personId: taskAssignee.personId }).from(taskAssignee)
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.isDeleted, false)));
      return rows.map((r) => r.personId);
    });
  }

  // --- labels --------------------------------------------------------------
  async addLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: taskLabel.id }).from(taskLabel)
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.labelId, labelId), eq(taskLabel.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(taskLabel).values({ taskId, labelId });
    });
  }

  async removeLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(taskLabel)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.labelId, labelId)));
    });
  }

  async findLabelIds(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ labelId: taskLabel.labelId }).from(taskLabel)
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.isDeleted, false)));
      return rows.map((r) => r.labelId);
    });
  }
}
