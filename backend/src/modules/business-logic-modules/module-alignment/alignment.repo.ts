import { Injectable } from '@nestjs/common';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { AppException } from '../../../utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { alignmentLink } from 'src/infra/application-db/schema/okr.schema';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';
import { IAlignmentLinkEntity, INewAlignmentLink } from './alignment.interface';

@Injectable()
export class AlignmentRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async link(
    payload: INewAlignmentLink,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .insert(alignmentLink)
        .values({
          fromType: payload.fromType,
          fromId: payload.fromId,
          toType: payload.toType,
          toId: payload.toId,
          weight: payload.weight ?? '1.00',
        })
        .returning();
      return result as IAlignmentLinkEntity;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async unlink(id: number, tenancyInfo: IDBConfigOptions): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      await dbConnection
        .update(alignmentLink)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(alignmentLink.id, id));
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  /**
   * Find children: rows where toType/toId match the given parent — these are
   * the nodes that point UP to this parent (i.e. children aligned to parent).
   */
  async findChildren(
    toType: string,
    toId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(alignmentLink) })
        .from(alignmentLink)
        .where(
          and(
            eq(alignmentLink.toType, toType),
            eq(alignmentLink.toId, toId),
            eq(alignmentLink.isDeleted, false),
          ),
        );
      return results as IAlignmentLinkEntity[];
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findParents(
    fromType: string,
    fromId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(alignmentLink) })
        .from(alignmentLink)
        .where(
          and(
            eq(alignmentLink.fromType, fromType),
            eq(alignmentLink.fromId, fromId),
            eq(alignmentLink.isDeleted, false),
          ),
        );
      return results as IAlignmentLinkEntity[];
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
