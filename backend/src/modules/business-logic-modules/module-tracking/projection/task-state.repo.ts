import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { taskState } from 'src/infra/application-db/schema/task.schema';

export interface ITaskStateRow {
  taskId: number;
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}

type TaskStatePatch = Partial<{
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}>;

@Injectable()
export class TaskStateRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async findByTaskId(
    taskId: number,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<ITaskStateRow | null> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        const rows = await db
          .select()
          .from(taskState)
          .where(eq(taskState.taskId, taskId));
        return (rows[0] as ITaskStateRow) ?? null;
      },
      executor,
    );
  }

  async upsert(
    taskId: number,
    patch: TaskStatePatch,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        await db
          .insert(taskState)
          .values({
            taskId,
            ...(patch as object),
          })
          .onConflictDoUpdate({
            target: taskState.taskId,
            set: {
              ...(patch as object),
              updatedAt: new Date().toISOString(),
            },
          });
      },
      executor,
    );
  }

  async addTime(
    taskId: number,
    minutes: number,
    lastEventAt: string,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        await db
          .insert(taskState)
          .values({ taskId, totalTimeLoggedMinutes: minutes, lastEventAt })
          .onConflictDoUpdate({
            target: taskState.taskId,
            set: {
              totalTimeLoggedMinutes: sql`${taskState.totalTimeLoggedMinutes} + ${minutes}`,
              lastEventAt,
              updatedAt: new Date().toISOString(),
            },
          });
      },
      executor,
    );
  }
}
