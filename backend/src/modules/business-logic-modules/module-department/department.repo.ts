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
  isNull,
} from 'drizzle-orm';
import { AppException } from '../../../utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { department } from 'src/infra/application-db/schema/identity.schema';
import {
  INewDepartment,
  IUpdateDepartment,
  IQueryDepartmentParams,
  IDepartmentEntity,
} from './department.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class DepartmentRepository implements BaseRepo<IDepartmentEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewDepartment,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .insert(department)
        .values({
          name: item.name,
          description: item.description ?? null,
          parentId: item.parentId ?? null,
          leadPersonId: item.leadPersonId ?? null,
        })
        .returning();
      return result as IDepartmentEntity;
    });
  }

  async delete(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      await dbConnection
        .update(department)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(department.id, Number(id)));
    });
  }

  async update(
    id: number,
    payload: IUpdateDepartment,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.notFound('Department', id);
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
        .update(department)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(department.id, id))
        .returning();

      return updated as IDepartmentEntity;
    });
  }

  async query(
    searchParams: IQueryDepartmentParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      name,
      parentId,
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
      eq(department.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(department.id, id));
    if (ids?.length) conditions.push(inArray(department.id, ids));
    if (slug) conditions.push(eq(department.slug, slug));
    if (slugs?.length) conditions.push(inArray(department.slug, slugs));
    if (name) conditions.push(ilike(department.name, `%${name}%`));
    if (parentId !== undefined && parentId !== null) conditions.push(eq(department.parentId, parentId));
    if (leadPersonId !== undefined && leadPersonId !== null) conditions.push(eq(department.leadPersonId, leadPersonId));
    if (isActive !== undefined) conditions.push(eq(department.isActive, isActive));

    const whereCondition = and(...conditions);

    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const columnMap: Record<string, PgColumn> = {
        id: department.id as unknown as PgColumn,
        slug: department.slug as unknown as PgColumn,
        name: department.name as unknown as PgColumn,
        createdAt: department.createdAt as unknown as PgColumn,
        updatedAt: department.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo, whereCondition);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IDepartmentEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Department query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findByParentId(
    parentId: number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(
          and(
            eq(department.parentId, parentId),
            eq(department.isDeleted, false),
          ),
        )
        .orderBy(desc(department.createdAt));
      return results as IDepartmentEntity[];
    });
  }

  async findRoots(tenancyInfo: IDBConfigOptions): Promise<IDepartmentEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(
          and(
            isNull(department.parentId),
            eq(department.isDeleted, false),
          ),
        )
        .orderBy(desc(department.createdAt));
      return results as IDepartmentEntity[];
    });
  }

  async findByName(
    name: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(and(eq(department.name, name), eq(department.isDeleted, false)));
      return (result as IDepartmentEntity) || null;
    });
  }

  async findById(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(and(eq(department.id, Number(id)), eq(department.isDeleted, false)));
      return (result as IDepartmentEntity) || null;
    });
  }

  async existByID(id: number, tenancyInfo: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [{ c }] = await dbConnection
        .select({ c: count() })
        .from(department)
        .where(and(eq(department.id, id), eq(department.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(and(eq(department.slug, slug), eq(department.isDeleted, false)));
      return (result as IDepartmentEntity) || null;
    });
  }

  async countAll(tenancyInfo: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ count: count() })
        .from(department)
        .where(where ?? eq(department.isDeleted, false));
      return result.count;
    });
  }

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IDepartmentEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .where(eq(department.isDeleted, false))
        .orderBy(desc(department.createdAt));
      return results as IDepartmentEntity[];
    });
  }

  async findAll(
    searchParams: IQueryDepartmentParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IDepartmentEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(department) })
        .from(department)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IDepartmentEntity[];
    });
  }
}
