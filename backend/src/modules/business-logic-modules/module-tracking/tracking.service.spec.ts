import { TrackingService } from './tracking.service';
import { ACTIVITY_EVENT_EMITTED } from './tracking.events';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';

const makeCtx = (): IDBConfigOptions => ({
  database_uri: 'postgresql://test:test@localhost:5432/test',
  schema_id: 'test_schema',
  user_id: 1,
});

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'test-slug',
  occurredAt: '2026-06-27T10:00:00Z',
  recordedAt: null,
  actorPersonId: 1,
  subjectType: 'initiative',
  subjectId: 5,
  type: 'started',
  payload: {},
  source: 'human',
  confidence: null,
  rawInputId: null,
  correlationId: null,
  ...overrides,
});

// Sentinel standing in for the transactional executor handed to repo calls.
const TX = Symbol('tx');

describe('TrackingService (unit)', () => {
  let append: jest.Mock;
  let emit: jest.Mock;
  let measurementsAdd: jest.Mock;
  let keyResultsUpdate: jest.Mock;
  let projectorApply: jest.Mock;
  let withTenantTransaction: jest.Mock;
  let svc: TrackingService;

  beforeEach(() => {
    append = jest.fn().mockResolvedValue(makeEvent());
    emit = jest.fn();
    measurementsAdd = jest.fn().mockResolvedValue(undefined);
    keyResultsUpdate = jest.fn().mockResolvedValue(undefined);
    projectorApply = jest.fn().mockResolvedValue(undefined);
    // Run the work callback immediately with the sentinel tx, mirroring a
    // committed transaction.
    withTenantTransaction = jest.fn((_ctx, work) => work(TX));

    svc = new TrackingService(
      { append } as any,
      { emit } as any,
      { add: measurementsAdd } as any,
      { updateCurrentValue: keyResultsUpdate } as any,
      { withTenantTransaction } as any,
      { apply: projectorApply } as any,
      { apply: jest.fn() } as any,
    );
  });

  describe('start()', () => {
    it('appends the event on the transaction connection', async () => {
      await svc.start(5, 1, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: 5,
          subjectType: 'initiative',
          type: 'started',
          actorPersonId: 1,
        }),
        expect.anything(),
        TX,
      );
    });

    it('projects the event inside the same transaction', async () => {
      const event = makeEvent({ type: 'started' });
      append.mockResolvedValue(event);
      await svc.start(5, 1, makeCtx());
      expect(projectorApply).toHaveBeenCalledWith(event, expect.anything(), TX);
    });

    it('notifies decoupled listeners after the transaction commits', async () => {
      const event = makeEvent({ type: 'started' });
      append.mockResolvedValue(event);
      await svc.start(5, 1, makeCtx());
      expect(emit).toHaveBeenCalledWith(
        ACTIVITY_EVENT_EMITTED,
        expect.objectContaining({ event }),
      );
    });

    it('does not notify when the transaction throws', async () => {
      append.mockRejectedValue(new Error('boom'));
      await expect(svc.start(5, 1, makeCtx())).rejects.toThrow('boom');
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('pause/resume/block/unblock/complete/cancel', () => {
    it.each([
      ['pause', 'paused'],
      ['resume', 'resumed'],
      ['block', 'blocked'],
      ['unblock', 'unblocked'],
      ['complete', 'completed'],
      ['cancel', 'cancelled'],
    ])('%s() emits type=%s', async (method, type) => {
      await (svc as any)[method](5, 1, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({ type }),
        expect.anything(),
        TX,
      );
      expect(emit).toHaveBeenCalledWith(
        ACTIVITY_EVENT_EMITTED,
        expect.anything(),
      );
    });
  });

  describe('logTime()', () => {
    it('emits type=time_logged with payload { minutes }', async () => {
      await svc.logTime(5, 1, 90, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'time_logged', payload: { minutes: 90 } }),
        expect.anything(),
        TX,
      );
    });
  });

  describe('recordReason()', () => {
    it('emits type=reason_recorded with reason payload', async () => {
      await svc.recordReason('initiative', 5, 1, { reason: 'blocker', reasonClass: 'external' }, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reason_recorded',
          payload: { reason: 'blocker', reasonClass: 'external' },
        }),
        expect.anything(),
        TX,
      );
    });
  });

  describe('recordOutcome()', () => {
    it('emits type=outcome_recorded with result payload', async () => {
      await svc.recordOutcome(5, 1, { result: 'success' }, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'outcome_recorded',
          payload: { result: 'success' },
        }),
        expect.anything(),
        TX,
      );
    });
  });

  describe('measureKeyResult()', () => {
    it('appends key_result_measured event on subjectType=key_result', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured', occurredAt: '2026-06-27T12:00:00Z' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: 7,
          subjectType: 'key_result',
          type: 'key_result_measured',
          payload: { value: '42' },
          actorPersonId: 1,
        }),
        expect.anything(),
        TX,
      );
    });

    it('adds the measurement on the transaction connection', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured', occurredAt: '2026-06-27T12:00:00Z' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(measurementsAdd).toHaveBeenCalledWith(
        7,
        '42',
        event.occurredAt,
        event.id,
        expect.anything(),
        TX,
      );
    });

    it('updates the key result current value on the transaction connection', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured', occurredAt: '2026-06-27T12:00:00Z' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(keyResultsUpdate).toHaveBeenCalledWith(7, '42', expect.anything(), TX);
    });

    it('notifies listeners after the transaction commits', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(emit).toHaveBeenCalledWith(ACTIVITY_EVENT_EMITTED, expect.objectContaining({ event }));
    });

    it('does not write measurement or update when append fails', async () => {
      append.mockRejectedValue(new Error('append failed'));
      await expect(svc.measureKeyResult(7, 1, '42', makeCtx())).rejects.toThrow('append failed');
      expect(measurementsAdd).not.toHaveBeenCalled();
      expect(keyResultsUpdate).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });
});

describe('task lifecycle', () => {
  it('startTask appends a task-subject "started" event and projects task state', async () => {
    // Arrange: withTenantTransaction invokes its callback with a fake tx executor;
    // activityEvents.append returns an event echoing the input; both projectors are spies.
    const appended: any[] = [];
    const activityEvents = { append: jest.fn(async (input: any) => { const e = { id: 1, occurredAt: '2026-06-28T00:00:00Z', ...input }; appended.push(e); return e; }) };
    const initiativeProjector = { apply: jest.fn() };
    const taskProjector = { apply: jest.fn() };
    const dbProvider = { withTenantTransaction: jest.fn(async (_ctx: any, work: any) => work({} as any)) };
    const emitter = { emit: jest.fn() };
    const service = new (require('./tracking.service').TrackingService)(
      activityEvents, emitter, { add: jest.fn() }, { updateCurrentValue: jest.fn() }, dbProvider, initiativeProjector, taskProjector,
    );

    const event = await service.startTask(42, 7, { database_uri: 'x', schema_id: 'public', user_id: 7 } as any);

    expect(activityEvents.append).toHaveBeenCalledWith(expect.objectContaining({ subjectType: 'task', subjectId: 42, type: 'started', actorPersonId: 7 }), expect.anything(), expect.anything());
    expect(taskProjector.apply).toHaveBeenCalled();
    expect(event.subjectType).toBe('task');
  });
});
