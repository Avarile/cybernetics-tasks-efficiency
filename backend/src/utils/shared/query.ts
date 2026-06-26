import { type PgSelect } from 'drizzle-orm/pg-core';

export function withPagination<T extends PgSelect>(
  qb: T,
  page?: number,
  pageSize?: number,
) {
  if (!page) page = 1;
  if (!pageSize) pageSize = 50;

  return qb.limit(pageSize).offset((page - 1) * pageSize);
}

export type SortOrder = 'asc' | 'desc';
