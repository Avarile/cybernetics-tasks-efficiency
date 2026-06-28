import { Job } from 'bullmq';

// Mock @nestjs/bullmq so WorkerHost doesn't try to create a real Worker
jest.mock('@nestjs/bullmq', () => ({
  WorkerHost: class {
    worker: unknown;
  },
  OnWorkerEvent: () => () => undefined,
  Processor: () => () => undefined,
}));

// Import after mock
import { BaseProcessor } from './base.processor';

class ConcreteProcessor extends BaseProcessor {
  async handle(_job: Job): Promise<string> {
    return 'result';
  }
}

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: 'job-1',
    name: 'test-job',
    queueName: 'example',
    attemptsMade: 0,
    data: { foo: 'bar' },
    ...overrides,
  } as unknown as Job);

describe('BaseProcessor', () => {
  let processor: ConcreteProcessor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    processor = new ConcreteProcessor();
    logSpy = jest.spyOn(processor['logger'], 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);
  });

  it('returns handle() result and emits structured success log', async () => {
    const result = await processor.process(makeJob());
    expect(result).toBe('result');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'job:completed',
        queue: 'example',
        jobId: 'job-1',
        name: 'test-job',
      }),
    );
  });

  it('emits structured error log and rethrows when handle() throws', async () => {
    const boom = new Error('boom');
    jest.spyOn(processor, 'handle').mockRejectedValue(boom);
    await expect(processor.process(makeJob())).rejects.toThrow('boom');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'job:failed',
        queue: 'example',
        jobId: 'job-1',
      }),
    );
  });
});
