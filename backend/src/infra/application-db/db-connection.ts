import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IDBConfigOptions } from './application-db.module';
import { Pool } from 'pg';
import env, { is_live_env } from 'src/utils/env';

/**
 * A Drizzle query executor — either a pooled connection or an open
 * transaction. Repository methods accept this optionally so the same query
 * can run standalone (its own connection) or enlisted in a caller's
 * transaction. See `runQuery` in ./query-runner and `withTenantTransaction`.
 */
export type DbExecutor = NodePgDatabase<Record<string, never>>;

const host = env.DATABASE_MAIN_HOST;
const port = env.DATABASE_MAIN_PORT;
const userName = env.DATABASE_MAIN_USERNAME;
const password = env.DATABASE_MAIN_PASSWORD;
const database = env.DATABASE_MAIN_DATABASE;

const connectionURI = `postgresql://${host}:${port}/${database}?user=${userName}&password=${password}`;

@Injectable()
class ApplicationDBProvider implements OnModuleDestroy {
  private masterPool: Pool | undefined;
  // Reserved for future multi-tenant deployments. In the current single-tenant
  // setup every IDBConfigOptions.database_uri equals `connectionURI`, so all
  // traffic flows through `masterPool` and this map stays empty.
  private tenantPools: Map<string, Pool> = new Map();
  private readonly logger = new Logger(ApplicationDBProvider.name);

  constructor() {
    this.logger.log('Initializing application db module (pools created lazily)');
  }

  /** Drain all pools on shutdown so the process can exit cleanly (SIGTERM). */
  async onModuleDestroy(): Promise<void> {
    const pools = [
      ...(this.masterPool ? [this.masterPool] : []),
      ...this.tenantPools.values(),
    ];
    await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    this.masterPool = undefined;
    this.tenantPools.clear();
    this.logger.log('Database pools drained');
  }

  /** Lightweight readiness probe — verifies the master pool can serve a query. */
  async ping(): Promise<boolean> {
    const pool = this.getOrCreatePool(connectionURI);
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  }

  private getOrCreatePool(uri: string): Pool {
    if (uri === connectionURI) {
      if (!this.masterPool) {
        this.masterPool = new Pool({
          connectionString: uri,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });
        this.logger.log('Master db pool created');
      }
      return this.masterPool;
    }

    let pool = this.tenantPools.get(uri);
    if (!pool) {
      pool = new Pool({
        connectionString: uri,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      this.tenantPools.set(uri, pool);
      this.logger.log('Tenant db pool created for uri');
    }
    return pool;
  }

  public async getMasterConnection() {
    const pool = this.getOrCreatePool(connectionURI);
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "public";`);
      const dbConnection = drizzle(client, {
        logger: is_live_env ? false : true,
      });

      return { dbConnection, client };
    } catch (error) {
      client.release();
      this.logger.error('Failed to connect to the database', error);
      throw error;
    }
  }

  /**
   * Run `work` inside a single tenant-scoped database transaction. The same
   * client is used for every query issued via the executor passed to `work`,
   * so all writes commit or roll back atomically. Throwing from `work` rolls
   * the transaction back; the client is always returned to the pool.
   */
  public async withTenantTransaction<T>(
    payload: IDBConfigOptions,
    work: (tx: DbExecutor) => Promise<T>,
  ): Promise<T> {
    const pool = this.getOrCreatePool(payload.database_uri);
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${payload.schema_id}", public;`);
      const db = drizzle(client, { logger: is_live_env ? false : true });
      return await db.transaction(async (tx) => work(tx as unknown as DbExecutor));
    } finally {
      client.release();
    }
  }

  public async getTenantDBConnection(payload: IDBConfigOptions) {
    const pool = this.getOrCreatePool(payload.database_uri);
    const client = await pool.connect();
    try {
      // Set search_path to tenant schema first, then public for extension types
      // (e.g. vector, uuid-ossp register in public; must remain visible)
      await client.query(`SET search_path TO "${payload.schema_id}", public;`);

      const dbConnection = drizzle(client, {
        logger: is_live_env ? false : true,
      });

      return { dbConnection, client };
    } catch (error) {
      client.release();
      this.logger.error('Failed to connect to the database', error);
      throw error;
    }
  }
}

export default ApplicationDBProvider;
