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
import { person } from 'src/infra/application-db/schema/identity.schema';
import {
  INewPerson,
  IUpdatePerson,
  IQueryPersonParams,
  IPersonEntity,
} from './person.interface';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from '../../../utils/shared/interface';
import { withPagination } from '../../../utils/shared/query';
import { PgColumn } from 'drizzle-orm/pg-core';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';

// password_hash is credential material and must never leave this repository
// on any read or return path. Project it out once and reuse everywhere; the
// auth flow reads the hash via the separate PersonAccountRepository.
const { passwordHash: _passwordHash, ...safePersonColumns } =
  getTableColumns(person);

@Injectable()
export class PersonRepository implements BaseRepo<IPersonEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(
    item: INewPerson,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IPersonEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .insert(person)
        .values({
          name: item.name,
          email: item.email,
          passwordHash: item.passwordHash ?? null,
          role: item.role,
          departmentId: item.departmentId ?? null,
          teamId: item.teamId ?? null,
        })
        .returning(safePersonColumns);
      return result as IPersonEntity;
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
        .update(person)
        .set({
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(person.id, Number(id)));
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
    payload: IUpdatePerson,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IPersonEntity> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const existing = await this.findById(id, tenancyInfo);
      if (!existing) {
        AppException.throw(
          'RESOURCE_NOT_FOUND',
          `Error occurred during updating person, person id: ${id} not found`,
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
        .update(person)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(person.id, id))
        .returning(safePersonColumns);

      return updated as IPersonEntity;
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
    searchParams: IQueryPersonParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IBaseQueryResult> {
    const {
      name,
      email,
      role,
      departmentId,
      teamId,
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
      eq(person.isDeleted, isDeleted !== undefined ? isDeleted : false),
    ];

    if (id) conditions.push(eq(person.id, id));
    if (ids?.length) conditions.push(inArray(person.id, ids));
    if (slug) conditions.push(eq(person.slug, slug));
    if (slugs?.length) conditions.push(inArray(person.slug, slugs));
    if (name) conditions.push(ilike(person.name, `%${name}%`));
    if (email) conditions.push(ilike(person.email, `%${email}%`));
    if (role) conditions.push(eq(person.role, role));
    if (departmentId) conditions.push(eq(person.departmentId, departmentId));
    if (teamId) conditions.push(eq(person.teamId, teamId));
    if (isActive !== undefined) conditions.push(eq(person.isActive, isActive));

    const whereCondition = and(...conditions);

    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const columnMap: Record<string, PgColumn> = {
        id: person.id as unknown as PgColumn,
        slug: person.slug as unknown as PgColumn,
        name: person.name as unknown as PgColumn,
        email: person.email as unknown as PgColumn,
        role: person.role as unknown as PgColumn,
        createdAt: person.createdAt as unknown as PgColumn,
        updatedAt: person.updatedAt as unknown as PgColumn,
      };

      const sortConditions = sortOptions
        .map((option) => {
          const column = columnMap[option.SortBy] ?? columnMap.createdAt;
          return option.sortOrder === 'asc' ? asc(column) : desc(column);
        })
        .filter(Boolean);

      const query = dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(whereCondition)
        .orderBy(...sortConditions)
        .$dynamic();

      const results = await withPagination(query, page, pageSize);
      const totalCount = await this.countAll(tenancyInfo);
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: results as IPersonEntity[],
        pagination: { page, pageSize, total: totalCount, totalPages },
        status_code: HttpStatus.OK,
        message: 'Person query successful',
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

  async findByEmail(
    email: string,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IPersonEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(and(eq(person.email, email), eq(person.isDeleted, false)));
      return (result as IPersonEntity) || null;
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
  ): Promise<IPersonEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(and(eq(person.name, name), eq(person.isDeleted, false)));
      return (result as IPersonEntity) || null;
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
  ): Promise<IPersonEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(and(eq(person.id, Number(id)), eq(person.isDeleted, false)));
      return (result as IPersonEntity) || null;
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
        .from(person)
        .where(and(eq(person.id, id), eq(person.isDeleted, false)));
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
  ): Promise<IPersonEntity | null> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const [result] = await dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(and(eq(person.slug, slug), eq(person.isDeleted, false)));
      return (result as IPersonEntity) || null;
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
        .from(person)
        .where(eq(person.isDeleted, false));
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

  async queryAll(tenancyInfo: IDBConfigOptions): Promise<IPersonEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const results = await dbConnection
        .select(safePersonColumns)
        .from(person)
        .where(eq(person.isDeleted, false))
        .orderBy(desc(person.createdAt));
      return results as IPersonEntity[];
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
    searchParams: IQueryPersonParams,
    tenancyInfo: IDBConfigOptions,
  ): Promise<IPersonEntity[]> {
    const { dbConnection, client } =
      await this.dbProvider.getTenantDBConnection(tenancyInfo);

    try {
      const baseQuery = dbConnection
        .select(safePersonColumns)
        .from(person)
        .$dynamic();

      const result = await withPagination(
        baseQuery,
        searchParams.page,
        searchParams.pageSize,
      );
      return result as IPersonEntity[];
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
