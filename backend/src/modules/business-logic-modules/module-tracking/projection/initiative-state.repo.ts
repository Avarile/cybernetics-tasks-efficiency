import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { initiativeState } from 'src/infra/application-db/schema/tracking.schema';

export interface IInitiativeStateRow {
  initiativeId: number;
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}

type InitiativeStatePatch = Partial<{
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}>;

@Injectable()
export class InitiativeStateRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async findByInitiativeId(
    initiativeId: number,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<IInitiativeStateRow | null> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        const rows = await db
          .select()
          .from(initiativeState)
          .where(eq(initiativeState.initiativeId, initiativeId));
        return (rows[0] as IInitiativeStateRow) ?? null;
      },
      executor,
    );
  }

  async upsert(
    initiativeId: number,
    patch: InitiativeStatePatch,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        await db
          .insert(initiativeState)
          .values({
            initiativeId,
            ...(patch as object),
          })
          .onConflictDoUpdate({
            target: initiativeState.initiativeId,
            set: {
              ...(patch as object),
              updatedAt: new Date().toISOString(),
            },
          });
      },
      executor,
    );
  }
}
