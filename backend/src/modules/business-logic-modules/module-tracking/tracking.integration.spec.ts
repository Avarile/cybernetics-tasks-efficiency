import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { useTestSchema } from '../../../../test/db-setup';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { TrackingModule } from './tracking.module';
import { TrackingService } from './tracking.service';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { TaskRepository } from '../module-task/task.repo';
import { TaskStateRepository } from './projection/task-state.repo';

describe('TrackingService → InitiativeStateProjector (real DB integration)', () => {
  const { getCtx } = useTestSchema();
  let trackingService: TrackingService;
  let stateRepo: InitiativeStateRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        ApplicationDbModule,
        TrackingModule,
      ],
    }).compile();

    // init() triggers OnModuleInit hooks and wires @OnEvent listeners
    await moduleRef.init();

    trackingService = moduleRef.get(TrackingService);
    stateRepo = moduleRef.get(InitiativeStateRepository);
  }, 30_000);

  it('start → block → complete sequence projects status=completed end-to-end', async () => {
    const ctx = getCtx();
    // Use an arbitrary initiativeId — projection row is keyed by initiativeId only
    const initiativeId = 99_901;
    const actorId = 1;

    await trackingService.start(initiativeId, actorId, ctx);
    await trackingService.block(initiativeId, actorId, ctx);
    await trackingService.complete(initiativeId, actorId, ctx);

    const state = await stateRepo.findByInitiativeId(initiativeId, ctx);
    expect(state).not.toBeNull();
    expect(state!.status).toBe('completed');
    expect(state!.lastEventAt).not.toBeNull();
  });

  it('logTime accumulates correctly via projector', async () => {
    const ctx = getCtx();
    const initiativeId = 99_902;
    const actorId = 1;

    await trackingService.start(initiativeId, actorId, ctx);
    await trackingService.logTime(initiativeId, actorId, 30, ctx);
    await trackingService.logTime(initiativeId, actorId, 45, ctx);

    const state = await stateRepo.findByInitiativeId(initiativeId, ctx);
    expect(state!.totalTimeLoggedMinutes).toBe(75);
  });
});

describe('TrackingService → TaskStateProjector (real DB integration)', () => {
  const { getCtx } = useTestSchema();
  let trackingService: TrackingService;
  let taskRepo: TaskRepository;
  let taskStateRepo: TaskStateRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        ApplicationDbModule,
        TrackingModule,
      ],
    }).compile();

    await moduleRef.init();

    trackingService = moduleRef.get(TrackingService);
    taskRepo = moduleRef.get(TaskRepository);
    taskStateRepo = moduleRef.get(TaskStateRepository);
  }, 30_000);

  it('startTask appends event and projects task_state = in_progress', async () => {
    const ctx = getCtx();
    const created = await taskRepo.create(
      { initiativeId: 1, title: 'Integration Task', priority: 'none', createdByPersonId: 1 },
      ctx,
    );
    const event = await trackingService.startTask(created.id, 1, ctx);
    expect(event.subjectType).toBe('task');

    const state = await taskStateRepo.findByTaskId(created.id, ctx);
    expect(state?.status).toBe('in_progress');
    expect(state?.lastEventAt).toBe(event.occurredAt);

    // The denormalized task.status cache must also be updated so the OKR
    // roll-up (countByInitiative) and status-filtered queries return honest data.
    const summary = await taskRepo.countByInitiative(created.initiativeId, ctx);
    expect(summary.byStatus.in_progress).toBeGreaterThanOrEqual(1);
    expect(summary.byStatus.not_started).toBe(0);
  });
});
