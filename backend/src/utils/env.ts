import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'testing', 'production']).default('development'),
  PORT: z.coerce.number().min(1000).default(9100),
  HOST: z.string().default('localhost'),
  CORS_ORIGINS: z.string().optional(),

  // single-tenant deployment DB
  DATABASE_MAIN_HOST: z.string().default('localhost'),
  DATABASE_MAIN_PORT: z.coerce.number().default(5432),
  DATABASE_MAIN_USERNAME: z.string().default('postgres'),
  DATABASE_MAIN_PASSWORD: z.string().default('postgres'),
  DATABASE_MAIN_DATABASE: z.string().default('cybernetic'),
  COMPANY_SCHEMA: z.string().default('public'),

  // auth
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),
  APP_SALT_ROUNDS: z.coerce.number().default(10),
  ADMIN_ACCOUNT: z.string(),
  ADMIN_ACCOUNT_PASSWORD: z.string(),

  // bullmq/redis (infra wired this phase, used Phase 2+)
  REDIS_BULLMQ_HOST: z.string().default('localhost'),
  REDIS_BULLMQ_PORT: z.coerce.number().default(6379),
  REDIS_BULLMQ_PASSWORD: z.string().optional(),
  REDIS_BULLMQ_DB: z.coerce.number().default(0),
});

const env = envSchema.parse(process.env);
export default env;
export const is_live_env = env.NODE_ENV === 'production';
