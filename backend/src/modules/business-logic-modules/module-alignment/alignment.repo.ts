import { Injectable } from '@nestjs/common';
import { and, eq, getTableColumns } from 'drizzle-orm';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { alignmentLink } from 'src/infra/application-db/schema/okr.schema';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';
import { IAlignmentLinkEntity, INewAlignmentLink } from './alignment.interface';
import { AlignableType } from './alignment.constants';

@Injectable()
export class AlignmentRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async link(
    payload: INewAlignmentLink,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
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
    });
  }

  async unlink(id: number, tenancyInfo: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      await dbConnection
        .update(alignmentLink)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(alignmentLink.id, id));
    });
  }

  /**
   * Find children: rows where toType/toId match the given parent — these are
   * the nodes that point UP to this parent (i.e. children aligned to parent).
   */
  async findChildren(
    toType: AlignableType,
    toId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
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
    });
  }

  async findParents(
    fromType: AlignableType,
    fromId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IAlignmentLinkEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
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
    });
  }
}
