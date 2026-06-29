import { TaskStateProjector } from './task-state.projector';

const ev = (over: any) => ({
  id: 1, slug: 's', occurredAt: '2026-06-28T00:00:00Z', recordedAt: null, actorPersonId: 1,
  subjectType: 'task', subjectId: 42, type: 'started', payload: {}, source: 'human',
  confidence: null, rawInputId: null, correlationId: null, ...over,
});

describe('TaskStateProjector', () => {
  let repo: any;
  let taskRepo: any;
  let projector: TaskStateProjector;
  beforeEach(() => {
    repo = { upsert: jest.fn(), findByTaskId: jest.fn(), addTime: jest.fn() };
    taskRepo = { updateStatus: jest.fn(), updateCompletedAt: jest.fn() };
    projector = new TaskStateProjector(repo as any, taskRepo as any);
  });

  it('ignores non-task events', async () => {
    await projector.apply(ev({ subjectType: 'initiative' }) as any, {} as any);
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(taskRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('started → status in_progress', async () => {
    await projector.apply(ev({ type: 'started' }) as any, {} as any);
    expect(repo.upsert).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'in_progress' }), expect.anything(), undefined);
    expect(taskRepo.updateStatus).toHaveBeenCalledWith(42, 'in_progress', expect.anything(), undefined);
  });

  it('blocked → status blocked + blockedSince', async () => {
    await projector.apply(ev({ type: 'blocked', occurredAt: '2026-06-28T01:00:00Z' }) as any, {} as any);
    expect(repo.upsert).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'blocked', blockedSince: '2026-06-28T01:00:00Z' }), expect.anything(), undefined);
  });

  it('time_logged → calls addTime atomically', async () => {
    await projector.apply(ev({ type: 'time_logged', payload: { minutes: 15 } }) as any, {} as any);
    expect(repo.addTime).toHaveBeenCalledWith(42, 15, expect.any(String), expect.anything(), undefined);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
