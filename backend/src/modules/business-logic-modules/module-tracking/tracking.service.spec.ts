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

describe('TrackingService (unit)', () => {
  let append: jest.Mock;
  let emitAsync: jest.Mock;
  let measurementsAdd: jest.Mock;
  let keyResultsUpdate: jest.Mock;
  let svc: TrackingService;

  beforeEach(() => {
    append = jest.fn().mockResolvedValue(makeEvent());
    emitAsync = jest.fn().mockResolvedValue(undefined);
    measurementsAdd = jest.fn().mockResolvedValue(undefined);
    keyResultsUpdate = jest.fn().mockResolvedValue(undefined);

    svc = new TrackingService(
      { append } as any,
      { emitAsync } as any,
      { add: measurementsAdd } as any,
      { updateCurrentValue: keyResultsUpdate } as any,
    );
  });

  describe('start()', () => {
    it('calls append with subjectType=initiative, type=started, actorPersonId', async () => {
      await svc.start(5, 1, makeCtx());
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: 5,
          subjectType: 'initiative',
          type: 'started',
          actorPersonId: 1,
        }),
        expect.anything(),
      );
    });

    it('awaits emitAsync with ACTIVITY_EVENT_EMITTED and the returned event', async () => {
      const event = makeEvent({ type: 'started' });
      append.mockResolvedValue(event);
      await svc.start(5, 1, makeCtx());
      expect(emitAsync).toHaveBeenCalledWith(
        ACTIVITY_EVENT_EMITTED,
        expect.objectContaining({ event }),
      );
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
      );
      expect(emitAsync).toHaveBeenCalledWith(
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
      );
    });

    it('calls measurements.add with keyResultId, value, occurredAt, event.id', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured', occurredAt: '2026-06-27T12:00:00Z' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(measurementsAdd).toHaveBeenCalledWith(7, '42', event.occurredAt, event.id, expect.anything());
    });

    it('calls keyResults.updateCurrentValue with the new value', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured', occurredAt: '2026-06-27T12:00:00Z' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(keyResultsUpdate).toHaveBeenCalledWith(7, '42', expect.anything());
    });

    it('emits ACTIVITY_EVENT_EMITTED for key_result_measured', async () => {
      const event = makeEvent({ id: 42, type: 'key_result_measured' });
      append.mockResolvedValue(event);
      await svc.measureKeyResult(7, 1, '42', makeCtx());
      expect(emitAsync).toHaveBeenCalledWith(ACTIVITY_EVENT_EMITTED, expect.objectContaining({ event }));
    });
  });
});
