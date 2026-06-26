import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
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
  ): Promise<IInitiativeStateRow | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);
    try {
      const rows = await dbConnection
        .select()
        .from(initiativeState)
        .where(eq(initiativeState.initiativeId, initiativeId));
      return (rows[0] as IInitiativeStateRow) ?? null;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async upsert(
    initiativeId: number,
    patch: InitiativeStatePatch,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);
    try {
      await dbConnection
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
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }
}
