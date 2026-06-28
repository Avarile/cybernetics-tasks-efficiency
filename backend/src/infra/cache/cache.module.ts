import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import env from 'src/utils/env';
import { CACHE_DEFAULT_TTL_MS } from './cache.constants';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const store = await redisStore({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD,
          db: env.REDIS_CACHE_DB,
        });
        return {
          store: store as any,
          ttl: CACHE_DEFAULT_TTL_MS,
        };
      },
    }),
  ],
})
export class InfraCacheModule {}
