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
  JWT_EXPIRES_IN: z.string().default('1d'), // legacy; retained so older mocks still parse
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  REFRESH_COOKIE_NAME: z.string().default('cyb_refresh'),
  COOKIE_SECURE: z.string().transform((v) => v === 'true').default('false'),
  COOKIE_DOMAIN: z.string().optional(),
  APP_SALT_ROUNDS: z.coerce.number().default(10),
  ADMIN_ACCOUNT: z.string(),
  ADMIN_ACCOUNT_PASSWORD: z.string(),

  // redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_CACHE_DB: z.coerce.number().default(1),
  REDIS_BULLMQ_DB: z.coerce.number().default(0),

  // task tracking
  TASK_KEY_PREFIX: z.string().default('TASK'),
});

const env = envSchema.parse(process.env);
export default env;
export const is_live_env = env.NODE_ENV === 'production';
