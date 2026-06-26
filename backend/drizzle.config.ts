import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/infra/application-db/schema/index.ts',
  out: './src/infra/application-db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DATABASE_MAIN_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_MAIN_PORT ?? 5432),
    user: process.env.DATABASE_MAIN_USERNAME ?? 'postgres',
    password: process.env.DATABASE_MAIN_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_MAIN_DATABASE ?? 'cybernetic',
  },
});
