// backend/src/infra/queue/schedule/schedule.registrar.spec.ts
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ScheduleRegistrar } from './schedule.registrar';
import { SCHEDULED_JOBS } from './schedule.config';
import { QueueName } from '../queue.constants';

const mockUpsert = jest.fn().mockResolvedValue(undefined);
const mockGetSchedulers = jest.fn();
const mockRemove = jest.fn().mockResolvedValue(undefined);

const mockQueue = {
  upsertJobScheduler: mockUpsert,
  getJobSchedulers: mockGetSchedulers,
  removeJobScheduler: mockRemove,
};

describe('ScheduleRegistrar', () => {
  let registrar: ScheduleRegistrar;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ScheduleRegistrar,
        { provide: getQueueToken(QueueName.EXAMPLE), useValue: mockQueue },
      ],
    }).compile();
    registrar = module.get(ScheduleRegistrar);
  });

  it('upserts a job scheduler for each SCHEDULED_JOBS entry', async () => {
    mockGetSchedulers.mockResolvedValue([]);
    await registrar.onApplicationBootstrap();
    expect(mockUpsert).toHaveBeenCalledTimes(SCHEDULED_JOBS.length);
    const firstEntry = SCHEDULED_JOBS[0];
    expect(mockUpsert).toHaveBeenCalledWith(
      firstEntry.id,
      { pattern: firstEntry.cron, tz: firstEntry.tz },
      { name: firstEntry.jobName, data: firstEntry.data ?? {} },
    );
  });

  it('prunes schedulers whose id is not in SCHEDULED_JOBS', async () => {
    mockGetSchedulers.mockResolvedValue([{ key: 'stale-id', name: 'old' }]);
    await registrar.onApplicationBootstrap();
    expect(mockRemove).toHaveBeenCalledWith('stale-id');
  });

  it('does not prune schedulers that are still in SCHEDULED_JOBS', async () => {
    const keepId = SCHEDULED_JOBS[0].id;
    mockGetSchedulers.mockResolvedValue([{ key: keepId, name: 'heartbeat' }]);
    await registrar.onApplicationBootstrap();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
