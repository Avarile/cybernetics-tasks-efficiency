import { InitiativeStateProjector } from './initiative-state.projector';
import { IActivityEventEntity } from '../tracking.interface';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';

const makeCtx = (): IDBConfigOptions => ({
  database_uri: 'postgresql://test:test@localhost:5432/test',
  schema_id: 'test_schema',
  user_id: 1,
});

const makeEvent = (
  overrides: Partial<IActivityEventEntity> = {},
): IActivityEventEntity => ({
  id: 1,
  slug: 'test-slug',
  occurredAt: '2026-06-27T10:00:00Z',
  recordedAt: null,
  actorPersonId: 1,
  subjectType: 'initiative',
  subjectId: 9,
  type: 'started',
  payload: {},
  source: 'human',
  confidence: null,
  rawInputId: null,
  correlationId: null,
  ...overrides,
});

describe('InitiativeStateProjector', () => {
  let repo: { upsert: jest.Mock; findByInitiativeId: jest.Mock };
  let projector: InitiativeStateProjector;

  beforeEach(() => {
    repo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findByInitiativeId: jest.fn().mockResolvedValue(null),
    };
    projector = new InitiativeStateProjector(repo as any);
  });

  it('blocked sets status=blocked and blockedSince', async () => {
    const event = makeEvent({ type: 'blocked', occurredAt: '2026-06-27T10:00:00Z' });
    await projector.apply(event, makeCtx());
    expect(repo.upsert).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        status: 'blocked',
        blockedSince: '2026-06-27T10:00:00Z',
        lastEventAt: '2026-06-27T10:00:00Z',
      }),
      expect.anything(),
      undefined,
    );
  });

  it('time_logged accumulates minutes from current state', async () => {
    repo.findByInitiativeId.mockResolvedValue({ totalTimeLoggedMinutes: 10 });
    const event = makeEvent({ type: 'time_logged', payload: { minutes: 30 } });
    await projector.apply(event, makeCtx());
    expect(repo.upsert).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ totalTimeLoggedMinutes: 40 }),
      expect.anything(),
      undefined,
    );
    expect(repo.findByInitiativeId).toHaveBeenCalledWith(
      9,
      expect.anything(),
      undefined,
    );
  });

  it('ignores non-initiative subjects (e.g. key_result)', async () => {
    const event = makeEvent({ subjectType: 'key_result', type: 'started' });
    await projector.apply(event, makeCtx());
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
