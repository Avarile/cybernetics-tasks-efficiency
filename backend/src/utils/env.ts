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

  // file management / storage
  FILE_STORAGE_PROVIDER: z.enum(['local', 'minio']).default('local'),
  FILE_PRIVATE_BUCKET: z.string().default('private'),
  FILE_PUBLIC_BUCKET: z.string().default('public'),
  FILE_UPLOAD_METHOD: z.string().default('PUT'),
  FILE_TOKEN_EXPIRE_IN: z.string().default('6d'),
  FILE_URL_EXPIRE_IN: z.string().default('6d'),
  FILE_MAX_UPLOAD_SIZE: z.coerce.number().default(52428800),
  FILE_TOKEN_SECRET: z.string().default('dev-insecure-file-token-secret-change-me'),
  FILE_LOCAL_PATH: z.string().default('.storage'),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_REGION: z.string().optional(),
  MINIO_INTERNAL_ENDPOINT: z.string().optional(),
  MINIO_INTERNAL_PORT: z.coerce.number().default(9000),

  // email / mail-sender
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().default(465),
  MAIL_SECURE: z.string().transform((v) => v === 'true').default('true'),
  MAIL_AUTH_USER: z.string().optional(),
  MAIL_AUTH_PASS: z.string().optional(),
  MAIL_SENDER: z.string().default('noreply@cybernetic.local'),
  MAIL_SENDER_NAME: z.string().default('Cybernetic'),
  MAIL_CONNECTION_TIMEOUT: z.coerce.number().default(10000),
  MAIL_GREETING_TIMEOUT: z.coerce.number().default(10000),
  MAIL_DNS_TIMEOUT: z.coerce.number().default(5000),
  MAIL_RATE_LIMIT_SECONDS: z.coerce.number().default(60),
  PUBLIC_ORIGIN: z.string().default('http://localhost:3000'),
});

const env = envSchema.parse(process.env);
export default env;
export const is_live_env = env.NODE_ENV === 'production';
