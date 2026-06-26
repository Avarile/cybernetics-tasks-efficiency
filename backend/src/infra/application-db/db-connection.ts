import { Injectable, Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { IDBConfigOptions } from './application-db.module';
import { Pool } from 'pg';
import env, { is_live_env } from 'src/utils/env';

const host = env.DATABASE_MAIN_HOST;
const port = env.DATABASE_MAIN_PORT;
const userName = env.DATABASE_MAIN_USERNAME;
const password = env.DATABASE_MAIN_PASSWORD;
const database = env.DATABASE_MAIN_DATABASE;

const connectionURI = `postgresql://${host}:${port}/${database}?user=${userName}&password=${password}`;

@Injectable()
class ApplicationDBProvider {
  private masterPool: Pool | undefined;
  private tenantPools: Map<string, Pool> = new Map();
  private readonly logger = new Logger(ApplicationDBProvider.name);

  constructor() {
    this.logger.warn('Initializing application db module (pools created lazily)');
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
        this.logger.warn('Master db pool created');
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
      this.logger.warn('Tenant db pool created for uri');
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
