import { Injectable } from '@nestjs/common';
import { asc, eq, and } from 'drizzle-orm';
import { AppException } from '../../../utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { activityEvent } from 'src/infra/application-db/schema/tracking.schema';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  IActivityEventInput,
  IActivityEventEntity,
} from './tracking.interface';

@Injectable()
export class ActivityEventRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async append(
    input: IActivityEventInput,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);

    try {
      const result = await dbConnection
        .insert(activityEvent)
        .values({
          occurredAt: input.occurredAt ?? new Date().toISOString(),
          actorPersonId: input.actorPersonId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          type: input.type,
          payload: input.payload ?? {},
          source: input.source ?? 'human',
          confidence:
            input.confidence != null ? String(input.confidence) : null,
          rawInputId: input.rawInputId ?? null,
          correlationId: input.correlationId ?? null,
        })
        .returning();
      return result[0] as IActivityEventEntity;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async listBySubject(
    subjectType: 'initiative' | 'key_result' | 'objective',
    subjectId: number,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(ctx);

    try {
      const results = await dbConnection
        .select()
        .from(activityEvent)
        .where(
          and(
            eq(activityEvent.subjectType, subjectType),
            eq(activityEvent.subjectId, subjectId),
          ),
        )
        .orderBy(asc(activityEvent.occurredAt));
      return results as IActivityEventEntity[];
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
