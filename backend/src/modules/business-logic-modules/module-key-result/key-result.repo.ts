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
import { AppException } from '../../../utils/exception.provider';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { keyResult } from 'src/infra/application-db/schema/okr.schema';
import {
  INewKeyResult,
  IUpdateKeyResult,
  IQueryKeyResultParams,
  IKeyResultEntity,
} from './key-result.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class KeyResultRepository implements BaseRepo<IKeyResultEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewKeyResult,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .insert(keyResult)
        .values({
          objectiveId: item.objectiveId,
          title: item.title,
          metricType: item.metricType,
          unit: item.unit ?? null,
          startValue: item.startValue ?? null,
          targetValue: item.targetValue ?? null,
          currentValue: item.currentValue ?? null,
          direction: item.direction,
        })
        .returning();
      return result as IKeyResultEntity;
    });
  }

  async delete(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      await dbConnection
        .update(keyResult)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(keyResult.id, Number(id)));
    });
  }

  async update(
    id: number,
    payload: IUpdateKeyResult,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.notFound('KeyResult', id);
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
        .update(keyResult)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(keyResult.id, id))
        .returning();

      return updated as IKeyResultEntity;
    });
  }

  async updateCurrentValue(
    id: number,
    value: string,
    tenancyInfo: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<IKeyResultEntity> {
    return runQuery(
      this.dbProvider,
      tenancyInfo,
      async (db) => {
        const [updated] = await db
          .update(keyResult)
          .set({ currentValue: value, updatedAt: new Date().toISOString() })
          .where(eq(keyResult.id, id))
          .returning();
        return updated as IKeyResultEntity;
      },
      executor,
    );
  }

  async findById(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .where(and(eq(keyResult.id, Number(id)), eq(keyResult.isDeleted, false)));
      return (result as IKeyResultEntity) || null;
    });
  }

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .where(and(eq(keyResult.slug, slug), eq(keyResult.isDeleted, false)));
      return (result as IKeyResultEntity) || null;
    });
  }

  async findByObjectiveId(
    objectiveId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .where(and(eq(keyResult.objectiveId, objectiveId), eq(keyResult.isDeleted, false)))
        .orderBy(desc(keyResult.createdAt));
      return results as IKeyResultEntity[];
    });
  }

  async query(
    searchParams: IQueryKeyResultParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      objectiveId,
      title,
      metricType,
      direction,
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
      eq(keyResult.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(keyResult.id, id));
    if (ids?.length) conditions.push(inArray(keyResult.id, ids));
    if (slug) conditions.push(eq(keyResult.slug, slug));
    if (slugs?.length) conditions.push(inArray(keyResult.slug, slugs));
    if (title) conditions.push(ilike(keyResult.title, `%${title}%`));
    if (objectiveId) conditions.push(eq(keyResult.objectiveId, objectiveId));
    if (metricType) conditions.push(eq(keyResult.metricType, metricType));
    if (direction) conditions.push(eq(keyResult.direction, direction));
    if (isActive !== undefined) conditions.push(eq(keyResult.isActive, isActive));

    const whereCondition = and(...conditions);

    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const columnMap: Record<string, PgColumn> = {
        id: keyResult.id as unknown as PgColumn,
        slug: keyResult.slug as unknown as PgColumn,
        title: keyResult.title as unknown as PgColumn,
        createdAt: keyResult.createdAt as unknown as PgColumn,
        updatedAt: keyResult.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo, whereCondition);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IKeyResultEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Key result query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IKeyResultEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .where(eq(keyResult.isDeleted, false))
        .orderBy(desc(keyResult.createdAt));
      return results as IKeyResultEntity[];
    });
  }

  async existByID(id: number, tenancyInfo: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [{ c }] = await dbConnection
        .select({ c: count() })
        .from(keyResult)
        .where(and(eq(keyResult.id, id), eq(keyResult.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async countAll(tenancyInfo: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ count: count() })
        .from(keyResult)
        .where(where ?? eq(keyResult.isDeleted, false));
      return result.count;
    });
  }

  async findAll(
    searchParams: IQueryKeyResultParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IKeyResultEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(keyResult) })
        .from(keyResult)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IKeyResultEntity[];
    });
  }
}
