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
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { objective } from 'src/infra/application-db/schema/okr.schema';
import { person } from 'src/infra/application-db/schema/identity.schema';
import {
  INewObjective,
  IUpdateObjective,
  IQueryObjectiveParams,
  IObjectiveEntity,
} from './objective.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class ObjectiveRepository implements BaseRepo<IObjectiveEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewObjective,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .insert(objective)
        .values({
          title: item.title,
          description: item.description ?? null,
          ownerPersonId: item.ownerPersonId,
          scope: item.scope,
          scopeRefId: item.scopeRefId ?? null,
          period: item.period,
          status: item.status,
        })
        .returning();
      return result as IObjectiveEntity;
    });
  }

  async delete(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      await dbConnection
        .update(objective)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(objective.id, Number(id)));
    });
  }

  async update(
    id: number,
    payload: IUpdateObjective,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [existing] = await dbConnection
        .select({ id: objective.id })
        .from(objective)
        .where(and(eq(objective.id, id), eq(objective.isDeleted, false)));

      if (!existing) {
        AppException.notFound('Objective', id);
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
        .update(objective)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(objective.id, id))
        .returning();

      return updated as IObjectiveEntity;
    });
  }

  async findById(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(and(eq(objective.id, Number(id)), eq(objective.isDeleted, false)));
      return (result as IObjectiveEntity) || null;
    });
  }

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(and(eq(objective.slug, slug), eq(objective.isDeleted, false)));
      return (result as IObjectiveEntity) || null;
    });
  }

  async findByOwner(
    ownerPersonId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(and(eq(objective.ownerPersonId, ownerPersonId), eq(objective.isDeleted, false)))
        .orderBy(desc(objective.createdAt));
      return results as IObjectiveEntity[];
    });
  }

  async findByScope(
    scope: 'org' | 'department' | 'team',
    scopeRefId: number | null | undefined,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const conditions: SQL[] = [
        eq(objective.scope, scope),
        eq(objective.isDeleted, false),
      ];
      if (scopeRefId !== null && scopeRefId !== undefined) {
        conditions.push(eq(objective.scopeRefId, scopeRefId));
      }

      const results = await dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(and(...conditions))
        .orderBy(desc(objective.createdAt));
      return results as IObjectiveEntity[];
    });
  }

  async query(
    searchParams: IQueryObjectiveParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      title,
      ownerPersonId,
      scope,
      status,
      period,
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
      eq(objective.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(objective.id, id));
    if (ids?.length) conditions.push(inArray(objective.id, ids));
    if (slug) conditions.push(eq(objective.slug, slug));
    if (slugs?.length) conditions.push(inArray(objective.slug, slugs));
    if (title) conditions.push(ilike(objective.title, `%${title}%`));
    if (ownerPersonId) conditions.push(eq(objective.ownerPersonId, ownerPersonId));
    if (scope) conditions.push(eq(objective.scope, scope));
    if (status) conditions.push(eq(objective.status, status));
    if (period) conditions.push(eq(objective.period, period));
    if (isActive !== undefined) conditions.push(eq(objective.isActive, isActive));

    const whereCondition = and(...conditions);

    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const columnMap: Record<string, PgColumn> = {
        id: objective.id as unknown as PgColumn,
        slug: objective.slug as unknown as PgColumn,
        title: objective.title as unknown as PgColumn,
        period: objective.period as unknown as PgColumn,
        createdAt: objective.createdAt as unknown as PgColumn,
        updatedAt: objective.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo, whereCondition);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IObjectiveEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Objective query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IObjectiveEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(eq(objective.isDeleted, false))
        .orderBy(desc(objective.createdAt));
      return results as IObjectiveEntity[];
    });
  }

  async existByID(id: number, tenancyInfo: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [{ c }] = await dbConnection
        .select({ c: count() })
        .from(objective)
        .where(and(eq(objective.id, id), eq(objective.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async countAll(tenancyInfo: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ count: count() })
        .from(objective)
        .where(where ?? eq(objective.isDeleted, false));
      return result.count;
    });
  }

  async findAll(
    searchParams: IQueryObjectiveParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IObjectiveEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(objective), ownerName: person.name })
        .from(objective)
        .leftJoin(person, eq(objective.ownerPersonId, person.id))
        .where(eq(objective.isDeleted, false))
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IObjectiveEntity[];
    });
  }
}
