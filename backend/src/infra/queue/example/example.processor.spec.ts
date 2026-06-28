import { Job } from 'bullmq';

jest.mock('@nestjs/bullmq', () => ({
  WorkerHost: class {
    worker: unknown;
  },
  OnWorkerEvent: () => () => undefined,
  Processor: () => () => undefined,
}));

import { ExampleProcessor } from './example.processor';

describe('ExampleProcessor', () => {
  let processor: ExampleProcessor;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    processor = new ExampleProcessor();
    debugSpy = jest
      .spyOn(processor['logger'], 'debug')
      .mockImplementation(() => undefined);
  });

  it('processes job payload and logs debug', async () => {
    const job = {
      id: 'ex-1',
      name: 'heartbeat',
      queueName: 'example',
      attemptsMade: 0,
      data: { ts: 123 },
    } as unknown as Job;

    const result = await processor.handle(job);
    expect(result).toBeUndefined();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'example:job', name: 'heartbeat' }),
    );
  });
});
