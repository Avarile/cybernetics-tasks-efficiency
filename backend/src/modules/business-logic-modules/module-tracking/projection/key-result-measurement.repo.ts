import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { keyResultMeasurement } from 'src/infra/application-db/schema/tracking.schema';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';

@Injectable()
export class KeyResultMeasurementRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async add(
    keyResultId: number,
    value: string,
    measuredAt: string,
    sourceEventId: number | null,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    return runQuery(
      this.dbProvider,
      ctx,
      async (db) => {
        await db.insert(keyResultMeasurement).values({
          keyResultId,
          value,
          measuredAt,
          sourceEventId: sourceEventId ?? null,
        });
      },
      executor,
    );
  }

  async seriesFor(
    keyResultId: number,
    ctx: IDBConfigOptions,
  ): Promise<Record<string, unknown>[]> {
    return runQuery(this.dbProvider, ctx, async (dbConnection) => {
      const rows = await dbConnection
        .select()
        .from(keyResultMeasurement)
        .where(eq(keyResultMeasurement.keyResultId, keyResultId))
        .orderBy(asc(keyResultMeasurement.measuredAt));
      return rows as Record<string, unknown>[];
    });
  }
}
