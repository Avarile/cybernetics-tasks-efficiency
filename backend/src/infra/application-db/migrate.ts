/**
 * Migration script — run via: yarn db:migrate
 * Creates the company schema if absent, sets search_path, then runs drizzle migrate().
 * schema/index.ts is currently empty (export {}); populate in Tasks 4/9/10.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import env from 'src/utils/env';

const connectionURI = `postgresql://${env.DATABASE_MAIN_HOST}:${env.DATABASE_MAIN_PORT}/${env.DATABASE_MAIN_DATABASE}?user=${env.DATABASE_MAIN_USERNAME}&password=${env.DATABASE_MAIN_PASSWORD}`;

async function runMigrations() {
  const pool = new Pool({ connectionString: connectionURI });
  const client = await pool.connect();

  try {
    // Ensure schema exists before setting search_path
    await client.query(
      `CREATE SCHEMA IF NOT EXISTS "${env.COMPANY_SCHEMA}";`,
    );
    await client.query(
      `SET search_path TO "${env.COMPANY_SCHEMA}", public;`,
    );

    const db = drizzle(client);

    await migrate(db, {
      migrationsFolder: './src/infra/application-db/migrations',
    });

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
