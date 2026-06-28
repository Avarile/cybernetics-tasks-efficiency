import ApplicationDBProvider, { DbExecutor } from './db-connection';
import { IDBConfigOptions } from './application-db.module';
import { AppException, BusinessException } from 'src/utils/exception.provider';

/**
 * Execute `fn` against a Drizzle executor.
 *
 * - When `executor` is provided (the caller owns a transaction), `fn` runs on
 *   it directly and errors are allowed to propagate so the caller's
 *   transaction rolls back.
 * - Otherwise a tenant connection is acquired, `fn` runs on it, errors are
 *   normalised to `DATABASE_QUERY_FAILED`, and the client is always released.
 *
 * This lets a repository method run standalone or be enlisted in a
 * multi-write transaction without duplicating its query body.
 */
export async function runQuery<T>(
  provider: ApplicationDBProvider,
  ctx: IDBConfigOptions,
  fn: (db: DbExecutor) => Promise<T>,
  executor?: DbExecutor,
): Promise<T> {
  if (executor) {
    return fn(executor);
  }

  const { dbConnection, client } = await provider.getTenantDBConnection(ctx);
  try {
    return await fn(dbConnection as unknown as DbExecutor);
  } catch (e) {
    // Domain errors raised inside `fn` (e.g. RESOURCE_NOT_FOUND) must keep
    // their status; only unexpected failures map to DATABASE_QUERY_FAILED.
    if (e instanceof BusinessException) throw e;
    AppException.throw(
      'DATABASE_QUERY_FAILED',
      e instanceof Error ? e.message : 'Database operation failed',
    );
  } finally {
    client.release();
  }
}
