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
import { team } from 'src/infra/application-db/schema/identity.schema';
import {
  INewTeam,
  IUpdateTeam,
  IQueryTeamParams,
  ITeamEntity,
} from './team.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class TeamRepository implements BaseRepo<ITeamEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewTeam,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .insert(team)
        .values({
          name: item.name,
          departmentId: item.departmentId,
          leadPersonId: item.leadPersonId ?? null,
        })
        .returning();
      return result as ITeamEntity;
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
        .update(team)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(team.id, Number(id)));
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
    payload: IUpdateTeam,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.throw(
          'RESOURCE_NOT_FOUND',
          `Error occurred during updating team, team id: ${id} not found`,
        );
      }

      // Exclude immutable fields and soft-delete fields (use delete() for that)
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
        .update(team)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(team.id, id))
        .returning();

      return updated as ITeamEntity;
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
    searchParams: IQueryTeamParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      name,
      departmentId,
      leadPersonId,
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
      eq(team.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(team.id, id));
    if (ids?.length) conditions.push(inArray(team.id, ids));
    if (slug) conditions.push(eq(team.slug, slug));
    if (slugs?.length) conditions.push(inArray(team.slug, slugs));
    if (name) conditions.push(ilike(team.name, `%${name}%`));
    if (departmentId !== undefined && departmentId !== null) conditions.push(eq(team.departmentId, departmentId));
    if (leadPersonId !== undefined && leadPersonId !== null) conditions.push(eq(team.leadPersonId, leadPersonId));
    if (isActive !== undefined) conditions.push(eq(team.isActive, isActive));

    const whereCondition = and(...conditions);

    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const columnMap: Record<string, PgColumn> = {
        id: team.id as unknown as PgColumn,
        slug: team.slug as unknown as PgColumn,
        name: team.name as unknown as PgColumn,
        createdAt: team.createdAt as unknown as PgColumn,
        updatedAt: team.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as ITeamEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Team query successful',
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

  async findByDepartmentId(
    departmentId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(
          and(
            eq(team.departmentId, departmentId),
            eq(team.isDeleted, false),
          ),
        )
        .orderBy(desc(team.createdAt));
      return results as ITeamEntity[];
    } catch (e) {
      AppException.throw(
        'DATABASE_QUERY_FAILED',
        e instanceof Error ? e.message : 'Database operation failed',
      );
    } finally {
      client.release();
    }
  }

  async findByName(
    name: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(and(eq(team.name, name), eq(team.isDeleted, false)));
      return (result as ITeamEntity) || null;
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
  ): Promise<ITeamEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(and(eq(team.id, Number(id)), eq(team.isDeleted, false)));
      return (result as ITeamEntity) || null;
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
        .from(team)
        .where(and(eq(team.id, id), eq(team.isDeleted, false)));
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

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(and(eq(team.slug, slug), eq(team.isDeleted, false)));
      return (result as ITeamEntity) || null;
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
        .from(team)
        .where(eq(team.isDeleted, false));
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

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<ITeamEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .where(eq(team.isDeleted, false))
        .orderBy(desc(team.createdAt));
      return results as ITeamEntity[];
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
    searchParams: IQueryTeamParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<ITeamEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(team) })
        .from(team)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as ITeamEntity[];
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
