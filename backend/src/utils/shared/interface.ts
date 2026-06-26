import { PgColumn } from 'drizzle-orm/pg-core';

export interface DefaultFields {
  id: number;
  slug: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean;
  isActive: boolean;
}

export interface UpdatableDefaultFields
  extends Partial<Omit<DefaultFields, 'id' | 'slug' | 'createdAt'>> {}

export interface AddressFields {
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface IGetByID {
  id: number;
}

export interface IGetByIDs {
  ids: Array<number>;
}

export interface IGetBySlug {
  slug: string;
}

export interface IGetBySlugs {
  slugs: Array<string>;
}

export interface IPaginationOptions {
  page?: number;
  pageSize: number;
}

export interface ISortOptions {
  SortBy: string;
  sortOrder: 'desc' | 'asc';
}

export interface IBaseQueryParams
  extends IGetByID,
    IGetByIDs,
    IGetBySlug,
    IGetBySlugs,
    IPaginationOptions,
    Pick<DefaultFields, 'isActive' | 'isDeleted'> {
  sortOptions?: Array<ISortOptions>;
}

export interface IBaseQueryResult {
  data: any;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  status_code?: number;
  message?: string;
  timestamp?: Date;
  error: string | string[] | number | null | undefined;
}

export interface IBaseResponse {
  data: any;
  status_code: number;
  message?: string;
  timestamp?: Date;
  error: string | string[] | null | undefined;
}

export function toISOStringSafe(dateLike: string | Date): string {
  if (dateLike instanceof Date) return dateLike.toISOString();

  const parsed = new Date(dateLike);
  if (isNaN(parsed.getTime())) throw new Error('Invalid date string');

  return parsed.toISOString();
}
