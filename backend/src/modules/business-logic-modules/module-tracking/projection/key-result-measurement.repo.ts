import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
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
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);
    try {
      await dbConnection.insert(keyResultMeasurement).values({
        keyResultId,
        value,
        measuredAt,
        sourceEventId: sourceEventId ?? null,
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

  async seriesFor(
    keyResultId: number,
    ctx: IDBConfigOptions,
  ): Promise<Record<string, unknown>[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);
    try {
      const rows = await dbConnection
        .select()
        .from(keyResultMeasurement)
        .where(eq(keyResultMeasurement.keyResultId, keyResultId))
        .orderBy(asc(keyResultMeasurement.measuredAt));
      return rows as Record<string, unknown>[];
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
