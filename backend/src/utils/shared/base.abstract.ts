import { SQL } from 'drizzle-orm';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IBaseQueryResult } from './interface';

/**
 * Contract for tenant-scoped repositories.
 * @typeParam T       the entity type the repository manages
 * @typeParam TQuery  the shape of the `query`/`findAll` search params
 */
export abstract class BaseRepo<T, TQuery = unknown> {
  abstract create(item: Partial<T>, tenancyInfo?: IDBConfigOptions): Promise<T>;
  abstract findById(
    id: string | number,
    tenancyInfo?: IDBConfigOptions,
  ): Promise<T | null>;
  abstract findBySlug(
    slug: string,
    tenancyInfo?: IDBConfigOptions,
  ): Promise<T | null>;
  abstract findAll(
    searchParams?: TQuery,
    tenancyInfo?: IDBConfigOptions,
  ): Promise<T[] | null>;
  abstract update(
    id: string | number,
    payload: Partial<T>,
    tenancyInfo?: IDBConfigOptions,
  ): Promise<T | null | void>;
  abstract delete(id: string | number, tenancyInfo?: IDBConfigOptions): Promise<void>;
  abstract countAll(tenancyInfo?: IDBConfigOptions, where?: SQL): Promise<number>;
  abstract query(searchParams: TQuery, tenancyInfo?: IDBConfigOptions): Promise<IBaseQueryResult>;
}
