import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';

export abstract class BaseRepo<T> {
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
    arg?: any,
    tenancyInfo?: IDBConfigOptions,
  ): Promise<T[] | null>;
  abstract update(
    id: string | number,
    payload: Partial<T>,
    tenancyInfo?: IDBConfigOptions
  ): Promise<T | null | void>;
  abstract delete(id: string | number, tenancyInfo?: IDBConfigOptions): Promise<void>;
  abstract countAll(tenancyInfo?: IDBConfigOptions): Promise<number>;
  abstract query(searchParams: Partial<unknown>, tenancyInfo?: IDBConfigOptions): Promise<any>;
}
