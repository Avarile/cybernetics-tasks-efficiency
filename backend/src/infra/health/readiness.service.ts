// backend/src/infra/health/readiness.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from 'cache-manager';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import ApplicationDBProvider from '../application-db/db-connection';
import { QueueName } from '../queue/queue.constants';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class ReadinessService {
  constructor(
    private readonly db: ApplicationDBProvider,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(QueueName.EXAMPLE) private readonly exampleQueue: Queue,
  ) {}

  async check(): Promise<{ db: string; redisCache: string; redisBull: string }> {
    const [dbResult, cacheResult, bullResult] = await Promise.allSettled([
      this.db.ping(),
      this.pingCache(),
      this.pingBullMq(),
    ]);

    const anyFailed = [dbResult, cacheResult, bullResult].some(
      (r) => r.status === 'rejected',
    );
    if (anyFailed) {
      AppException.throw('SERVICE_UNAVAILABLE', 'One or more dependencies are unreachable');
    }

    return { db: 'up', redisCache: 'up', redisBull: 'up' };
  }

  private async pingCache(): Promise<void> {
    const store = this.cache.store as unknown as { client: Redis };
    await store.client.ping();
  }

  private async pingBullMq(): Promise<void> {
    const client = (await this.exampleQueue.client) as unknown as Redis;
    await client.ping();
  }
}
