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
import { organization } from 'src/infra/application-db/schema/identity.schema';
import {
  INewOrganization,
  IUpdateOrganization,
  IQueryOrganizationParams,
  IOrganizationEntity,
} from './organization.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

@Injectable()
export class OrganizationRepository implements BaseRepo<IOrganizationEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewOrganization,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .insert(organization)
        .values({
          name: item.name,
          description: item.description ?? null,
        })
        .returning();
      return result as IOrganizationEntity;
    });
  }

  async delete(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<void> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      await dbConnection
        .update(organization)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(organization.id, Number(id)));
    });
  }

  async update(
    id: number,
    payload: IUpdateOrganization,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.notFound('Organization', id);
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
        .update(organization)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(organization.id, id))
        .returning();

      return updated as IOrganizationEntity;
    });
  }

  async query(
    searchParams: IQueryOrganizationParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      name,
      description,
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
      eq(organization.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(organization.id, id));
    if (ids?.length) conditions.push(inArray(organization.id, ids));
    if (slug) conditions.push(eq(organization.slug, slug));
    if (slugs?.length) conditions.push(inArray(organization.slug, slugs));
    if (name) conditions.push(ilike(organization.name, `%${name}%`));
    if (description) conditions.push(ilike(organization.description, `%${description}%`));
    if (isActive !== undefined) conditions.push(eq(organization.isActive, isActive));

    const whereCondition = and(...conditions);

    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const columnMap: Record<string, PgColumn> = {
        id: organization.id as unknown as PgColumn,
        slug: organization.slug as unknown as PgColumn,
        name: organization.name as unknown as PgColumn,
        createdAt: organization.createdAt as unknown as PgColumn,
        updatedAt: organization.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo, whereCondition);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IOrganizationEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Organization query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findByName(
    name: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .where(and(eq(organization.name, name), eq(organization.isDeleted, false)));
      return (result as IOrganizationEntity) || null;
    });
  }

  async findById(
    id: string | number,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .where(and(eq(organization.id, Number(id)), eq(organization.isDeleted, false)));
      return (result as IOrganizationEntity) || null;
    });
  }

  async existByID(id: number, tenancyInfo: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [{ c }] = await dbConnection
        .select({ c: count() })
        .from(organization)
        .where(and(eq(organization.id, id), eq(organization.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async findBySlug(
    slug: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity | null> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .where(and(eq(organization.slug, slug), eq(organization.isDeleted, false)));
      return (result as IOrganizationEntity) || null;
    });
  }

  async countAll(tenancyInfo: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const [result] = await dbConnection
        .select({ count: count() })
        .from(organization)
        .where(where ?? eq(organization.isDeleted, false));
      return result.count;
    });
  }

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IOrganizationEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const results = await dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .where(eq(organization.isDeleted, false))
        .orderBy(desc(organization.createdAt));
      return results as IOrganizationEntity[];
    });
  }

  async findAll(
    searchParams: IQueryOrganizationParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IOrganizationEntity[]> {
    return runQuery(this.dbProvider, tenancyInfo, async (dbConnection) => {
      const baseQuery = dbConnection
        .select({ ...getTableColumns(organization) })
        .from(organization)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IOrganizationEntity[];
    });
  }
}
