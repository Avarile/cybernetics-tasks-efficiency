/**
 * db-setup.ts
 *
 * Provides an isolated Postgres schema for repo specs.
 *
 * Usage:
 *   const { getCtx } = useTestSchema();
 *   // then in tests: const ctx = getCtx();
 *
 * Each call to useTestSchema() registers its own beforeAll/afterAll pair that:
 *   1. Creates a unique test schema (test_<timestamp>_<random>)
 *   2. Runs all *.sql migrations into it (one statement at a time)
 *   3. After the suite, drops the schema
 *
 * Note on enums: Drizzle migrations emit `CREATE TYPE "public"."person_role"`
 * which lives in the public schema (shared across test runs). We tolerate
 * "already exists" errors for CREATE TYPE so multiple suites can run against
 * the same database without clashing.
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { IDBConfigOptions } from '../src/infra/application-db/application-db.module';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../src/infra/application-db/migrations',
);

function buildUri(): string {
  const host = process.env.DATABASE_MAIN_HOST ?? 'localhost';
  const port = process.env.DATABASE_MAIN_PORT ?? '30898';
  const user = process.env.DATABASE_MAIN_USERNAME ?? 'avarile';
  const pass = process.env.DATABASE_MAIN_PASSWORD ?? '';
  const db = process.env.DATABASE_MAIN_DATABASE ?? 'application_business';
  return `postgresql://${host}:${port}/${db}?user=${user}&password=${pass}`;
}

function genSchemaName(): string {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Split a Drizzle migration file into individual statements.
 * Drizzle uses `--> statement-breakpoint` as a separator comment.
 * We split on that, then also strip trailing semicolons for safety
 * and skip blank statements.
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(/--> statement-breakpoint/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runMigrations(client: PoolClient, schemaName: string): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = splitStatements(raw);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err: any) {
        // 42710 = duplicate_object (type/relation already exists)
        // Tolerate this for CREATE TYPE statements (enums live in public
        // schema and persist between test runs on the same DB).
        if (
          err.code === '42710' &&
          /CREATE TYPE/i.test(stmt)
        ) {
          // expected — the enum already exists in public schema
          continue;
        }
        throw err;
      }
    }
  }
}

/**
 * Register beforeAll / afterAll hooks that spin up and tear down an isolated
 * Postgres schema. Returns a `getCtx()` accessor that is only valid inside
 * the test suite (i.e. after beforeAll has run).
 */
export function useTestSchema(): { getCtx: () => IDBConfigOptions } {
  const schemaName = genSchemaName();
  const uri = buildUri();
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: uri, max: 5 });
    const client = await pool.connect();
    try {
      // 1. Create the isolated test schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      // 2. Point search_path so table DDL lands in our schema;
      //    'public' stays visible for enum types (person_role etc.)
      await client.query(`SET search_path TO "${schemaName}", public`);
      // 3. Run migrations statement by statement
      await runMigrations(client, schemaName);
    } finally {
      client.release();
    }
  }, 30_000);

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      client.release();
    }
    await pool.end();
  }, 15_000);

  return {
    getCtx(): IDBConfigOptions {
      return { database_uri: uri, schema_id: schemaName, user_id: 1 };
    },
  };
}
