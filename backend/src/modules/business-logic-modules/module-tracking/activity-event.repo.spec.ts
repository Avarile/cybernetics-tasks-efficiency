import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { ActivityEventRepository } from './activity-event.repo';

describe('ActivityEventRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: ActivityEventRepository;

  beforeAll(() => {
    const dbProvider = new ApplicationDBProvider();
    repo = new ActivityEventRepository(dbProvider);
  });

  it('append inserts an immutable event and listBySubject returns it in order', async () => {
    const ctx = getCtx();
    const e1 = await repo.append(
      { actorPersonId: 1, subjectType: 'initiative', subjectId: 5, type: 'started' },
      ctx,
    );
    const e2 = await repo.append(
      {
        actorPersonId: 1,
        subjectType: 'initiative',
        subjectId: 5,
        type: 'completed',
        payload: { result: 'won' },
      },
      ctx,
    );

    expect(e1.id).toBeDefined();
    expect(e1.type).toBe('started');
    expect(e2.id).toBeDefined();
    expect(e2.type).toBe('completed');

    const list = await repo.listBySubject('initiative', 5, ctx);
    expect(list.map((e) => e.type)).toEqual(['started', 'completed']);
    expect(list[1].payload).toEqual({ result: 'won' });
  });

  it('has no update or delete method', () => {
    expect((repo as any).update).toBeUndefined();
    expect((repo as any).delete).toBeUndefined();
  });
});
