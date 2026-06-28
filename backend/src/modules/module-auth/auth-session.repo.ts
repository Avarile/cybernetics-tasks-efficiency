import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { authSession } from 'src/infra/application-db/schema/auth.schema';
import { AppException } from 'src/utils/exception.provider';
import { IAuthSessionRecord, ICreateAuthSession } from './auth.interface';

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly db: ApplicationDBProvider) {}

  async create(input: ICreateAuthSession, ctx: IDBConfigOptions): Promise<IAuthSessionRecord> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const [row] = await dbConnection
        .insert(authSession)
        .values({
          personId: input.personId,
          refreshTokenHash: input.refreshTokenHash,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          expiresAt: input.expiresAt,
        })
        .returning();
      return row as IAuthSessionRecord;
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async findActiveByHash(hash: string, ctx: IDBConfigOptions): Promise<IAuthSessionRecord | null> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const [row] = await dbConnection
        .select()
        .from(authSession)
        .where(
          and(
            eq(authSession.refreshTokenHash, hash),
            isNull(authSession.revokedAt),
            gt(authSession.expiresAt, new Date().toISOString()),
          ),
        )
        .limit(1);
      return (row as IAuthSessionRecord) ?? null;
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async revoke(id: number, ctx: IDBConfigOptions): Promise<void> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      await dbConnection
        .update(authSession)
        .set({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(authSession.id, id));
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async revokeAllForPerson(personId: number, ctx: IDBConfigOptions): Promise<void> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      await dbConnection
        .update(authSession)
        .set({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(authSession.personId, personId), isNull(authSession.revokedAt)));
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }
}
