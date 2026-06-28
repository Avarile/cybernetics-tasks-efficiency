// backend/src/infra/health/readiness.service.spec.ts
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { ReadinessService } from './readiness.service';
import ApplicationDBProvider from '../application-db/db-connection';
import { QueueName } from '../queue/queue.constants';
import { BusinessException } from 'src/utils/exception.provider';

const mockDbPing = jest.fn();
const mockCacheClientPing = jest.fn();
const mockBullClientPing = jest.fn();

const mockCache = { store: { client: { ping: mockCacheClientPing } } };
const mockQueue = { client: Promise.resolve({ ping: mockBullClientPing }) };

describe('ReadinessService', () => {
  let service: ReadinessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: ApplicationDBProvider, useValue: { ping: mockDbPing } },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: getQueueToken(QueueName.EXAMPLE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(ReadinessService);
  });

  it('returns { db, redisCache, redisBull } all "up" when all pings pass', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockResolvedValue('PONG');

    const result = await service.check();
    expect(result).toEqual({ db: 'up', redisCache: 'up', redisBull: 'up' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when db ping fails', async () => {
    mockDbPing.mockRejectedValue(new Error('db down'));
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockResolvedValue('PONG');

    await expect(service.check()).rejects.toBeInstanceOf(BusinessException);
    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when cache ping fails', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockRejectedValue(new Error('redis down'));
    mockBullClientPing.mockResolvedValue('PONG');

    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when BullMQ ping fails', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockRejectedValue(new Error('bull down'));

    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
