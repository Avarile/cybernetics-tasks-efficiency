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
import { initiative, initiativeKeyResult } from 'src/infra/application-db/schema/okr.schema';
import {
  INewInitiative,
  IUpdateInitiative,
  IQueryInitiativeParams,
  IInitiativeEntity,
} from './initiative.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class InitiativeRepository implements BaseRepo<IInitiativeEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewInitiative,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInitiativeEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .insert(initiative)
        .values({
          title: item.title,
          description: item.description ?? null,
          ownerPersonId: item.ownerPersonId,
          priority: item.priority,
          dueDate: item.dueDate ?? null,
          status: 'not_started',
        })
        .returning();
      return result as IInitiativeEntity;
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
        .update(initiative)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(initiative.id, Number(id)));
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
    payload: IUpdateInitiative,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInitiativeEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [existing] = await dbConnection
        .select({ id: initiative.id })
        .from(initiative)
        .where(and(eq(initiative.id, id), eq(initiative.isDeleted, false)));

      if (!existing) {
        AppException.throw(
          'RESOURCE_NOT_FOUND',
          `Initiative id ${id} not found`,
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
        .update(initiative)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(initiative.id, id))
        .returning();

      return updated as IInitiativeEntity;
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
    searchParams: IQueryInitiativeParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      title,
      ownerPersonId,
      priority,
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
      eq(initiative.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(initiative.id, id));
    if (ids?.length) conditions.push(inArray(initiative.id, ids));
    if (slug) conditions.push(eq(initiative.slug, slug));
    if (slugs?.length) conditions.push(inArray(initiative.slug, slugs));
    if (title) conditions.push(ilike(initiative.title, `%${title}%`));
    if (ownerPersonId) conditions.push(eq(initiative.ownerPersonId, ownerPersonId));
    if (priority) conditions.push(eq(initiative.priority, priority));
    if (isActive !== undefined) conditions.push(eq(initiative.isActive, isActive));

    const whereCondition = and(...conditions);

    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const columnMap: Record<string, PgColumn> = {
        id: initiative.id as unknown as PgColumn,
        slug: initiative.slug as unknown as PgColumn,
        title: initiative.title as unknown as PgColumn,
        createdAt: initiative.createdAt as unknown as PgColumn,
        updatedAt: initiative.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IInitiativeEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Initiative query successful',
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
  ): Promise<IInitiativeEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(and(eq(initiative.id, Number(id)), eq(initiative.isDeleted, false)));
      return (result as IInitiativeEntity) || null;
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
  ): Promise<IInitiativeEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(and(eq(initiative.slug, slug), eq(initiative.isDeleted, false)));
      return (result as IInitiativeEntity) || null;
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findByOwner(
    ownerPersonId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInitiativeEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(
          and(
            eq(initiative.ownerPersonId, ownerPersonId),
            eq(initiative.isDeleted, false),
          ),
        )
        .orderBy(desc(initiative.createdAt));
      return results as IInitiativeEntity[];
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
    initiativeId: number,
    keyResultId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      // Dedup guard: check if link already exists before inserting
      const existing = await dbConnection
        .select({ id: initiativeKeyResult.id })
        .from(initiativeKeyResult)
        .where(
          and(
            eq(initiativeKeyResult.initiativeId, initiativeId),
            eq(initiativeKeyResult.keyResultId, keyResultId),
            eq(initiativeKeyResult.isDeleted, false),
          ),
        );

      if (existing.length > 0) {
        return; // already linked — skip insert
      }

      await dbConnection
        .insert(initiativeKeyResult)
        .values({ initiativeId, keyResultId });
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
    initiativeId: number,
    keyResultId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      await dbConnection
        .update(initiativeKeyResult)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(initiativeKeyResult.initiativeId, initiativeId),
            eq(initiativeKeyResult.keyResultId, keyResultId),
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

  async findKeyResultIds(
    initiativeId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<number[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ keyResultId: initiativeKeyResult.keyResultId })
        .from(initiativeKeyResult)
        .where(
          and(
            eq(initiativeKeyResult.initiativeId, initiativeId),
            eq(initiativeKeyResult.isDeleted, false),
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
        .from(initiative)
        .where(and(eq(initiative.id, id), eq(initiative.isDeleted, false)));
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
        .from(initiative)
        .where(eq(initiative.isDeleted, false));
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

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IInitiativeEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(eq(initiative.isDeleted, false))
        .orderBy(desc(initiative.createdAt));
      return results as IInitiativeEntity[];
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
    searchParams: IQueryInitiativeParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IInitiativeEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(initiative) })
        .from(initiative)
        .where(eq(initiative.isDeleted, false))
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IInitiativeEntity[];
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
