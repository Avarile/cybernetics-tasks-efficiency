import { HttpStatus, Injectable } from '@nestjs/common';
import {
  eq,
  ilike,
  and,
  inArray,
  desc,
  asc,
  count,
  SQL,
  getTableColumns,
} from 'drizzle-orm';
import { AppException, BusinessException } from '../../../utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { intervention, interventionKeyResult } from 'src/infra/application-db/schema/okr.schema';
import {
  INewIntervention,
  IUpdateIntervention,
  IQueryInterventionParams,
  IInterventionEntity,
} from './intervention.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class InterventionRepository implements BaseRepo<IInterventionEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewIntervention,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInterventionEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .insert(intervention)
        .values({
          title: item.title,
          description: item.description ?? null,
          decidedByPersonId: item.decidedByPersonId,
          startedAt: item.startedAt,
          scope: item.scope,
          hypothesis: item.hypothesis ?? null,
          measurementWindowDays: item.measurementWindowDays ?? 14,
          status: 'planned',
        })
        .returning();
      return result as IInterventionEntity;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async delete(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      await dbConnection
        .update(intervention)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(intervention.id, Number(id)));
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async update(
    id: number,
    payload: IUpdateIntervention,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInterventionEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.throw(
          'RESOURCE_NOT_FOUND',
          `Error occurred during updating intervention, intervention id: ${id} not found`,
        );
      }

      const {
        id: _id,
        slug: _slug,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        isDeleted: _isDeleted,
        deletedAt: _deletedAt,
        ...updateData
      } = payload as any;

      const [updated] = await dbConnection
        .update(intervention)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(intervention.id, id))
        .returning();

      return updated as IInterventionEntity;
    } catch (e) {
      if (e instanceof BusinessException) {
        throw e;
      }
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async query(
    searchParams: IQueryInterventionParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      title,
      decidedByPersonId,
      scope,
      status,
      isDeleted,
      isActive,
      id,
      ids,
      slug,
      slugs,
      page = 1,
      pageSize = 50,
      sortOptions = [
        { SortBy: 'createdAt', sortOrder: 'desc' },
        { SortBy: 'updatedAt', sortOrder: 'desc' },
      ],
    } = searchParams;

    const conditions: SQL[] = [
      eq(intervention.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(intervention.id, id));
    if (ids?.length) conditions.push(inArray(intervention.id, ids));
    if (slug) conditions.push(eq(intervention.slug, slug));
    if (slugs?.length) conditions.push(inArray(intervention.slug, slugs));
    if (title) conditions.push(ilike(intervention.title, `%${title}%`));
    if (decidedByPersonId) conditions.push(eq(intervention.decidedByPersonId, decidedByPersonId));
    if (scope) conditions.push(eq(intervention.scope, scope));
    if (status) conditions.push(eq(intervention.status, status));
    if (isActive !== undefined) conditions.push(eq(intervention.isActive, isActive));

    const whereCondition = and(...conditions);

    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const columnMap: Record<string, PgColumn> = {
        id: intervention.id as unknown as PgColumn,
        slug: intervention.slug as unknown as PgColumn,
        title: intervention.title as unknown as PgColumn,
        createdAt: intervention.createdAt as unknown as PgColumn,
        updatedAt: intervention.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(intervention) })
        .from(intervention)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IInterventionEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Intervention query successful',
        timestamp: new Date(),
        error: null,
      };
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findById(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInterventionEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(intervention) })
        .from(intervention)
        .where(and(eq(intervention.id, Number(id)), eq(intervention.isDeleted, false)));
      return (result as IInterventionEntity) || null;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInterventionEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(intervention) })
        .from(intervention)
        .where(and(eq(intervention.slug, slug), eq(intervention.isDeleted, false)));
      return (result as IInterventionEntity) || null;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async linkKeyResult(
    interventionId: number,
    keyResultId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      // Dedup guard: check if link already exists before inserting
      const existing = await dbConnection
        .select({ id: interventionKeyResult.id })
        .from(interventionKeyResult)
        .where(
          and(
            eq(interventionKeyResult.interventionId, interventionId),
            eq(interventionKeyResult.keyResultId, keyResultId),
            eq(interventionKeyResult.isDeleted, false),
          ),
        );

      if (existing.length > 0) {
        return; // already linked — skip insert
      }

      await dbConnection
        .insert(interventionKeyResult)
        .values({ interventionId, keyResultId });
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async unlinkKeyResult(
    interventionId: number,
    keyResultId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      await dbConnection
        .update(interventionKeyResult)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(interventionKeyResult.interventionId, interventionId),
            eq(interventionKeyResult.keyResultId, keyResultId),
          ),
        );
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findAffectedKeyResultIds(
    interventionId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<number[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ keyResultId: interventionKeyResult.keyResultId })
        .from(interventionKeyResult)
        .where(
          and(
            eq(interventionKeyResult.interventionId, interventionId),
            eq(interventionKeyResult.isDeleted, false),
          ),
        );
      return results.map((r) => r.keyResultId);
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async existByID(id: number, tenancyInfo: IDBConfigOptions): Promise<boolean> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [{ c }] = await dbConnection
        .select({ c: count() })
        .from(intervention)
        .where(and(eq(intervention.id, id), eq(intervention.isDeleted, false)));
      return Number(c) > 0;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async countAll(tenancyInfo: IDBConfigOptions): Promise<number> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ count: count() })
        .from(intervention)
        .where(eq(intervention.isDeleted, false));
      return result.count;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IInterventionEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(intervention) })
        .from(intervention)
        .where(eq(intervention.isDeleted, false))
        .orderBy(desc(intervention.createdAt));
      return results as IInterventionEntity[];
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findAll(
    searchParams: IQueryInterventionParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInterventionEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(intervention) })
        .from(intervention)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IInterventionEntity[];
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
