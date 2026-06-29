import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { AppException } from 'src/utils/exception.provider';
import { ActivityEventRepository } from './activity-event.repo';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { TaskStateProjector } from './projection/task-state.projector';
import { TaskStateRepository } from './projection/task-state.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import {
  ACTIVITY_EVENT_EMITTED,
} from './tracking.events';
import {
  IActivityEventInput,
  IActivityEventEntity,
} from './tracking.interface';

// Valid prior states for each lifecycle event type.
const LIFECYCLE_TRANSITIONS: Partial<Record<IActivityEventInput['type'], string[]>> = {
  started:   ['not_started'],
  paused:    ['in_progress'],
  resumed:   ['paused'],
  blocked:   ['in_progress'],
  unblocked: ['blocked'],
  completed: ['in_progress', 'paused'],
  cancelled: ['not_started', 'in_progress', 'paused', 'blocked'],
};

@Injectable()
export class TrackingService {
  constructor(
    private readonly activityEvents: ActivityEventRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly measurements: KeyResultMeasurementRepository,
    private readonly keyResults: KeyResultRepository,
    private readonly dbProvider: ApplicationDBProvider,
    private readonly projector: InitiativeStateProjector,
    private readonly initiativeStateRepo: InitiativeStateRepository,
    private readonly taskProjector: TaskStateProjector,
    private readonly taskStateRepo: TaskStateRepository,
  ) {}

  /**
   * Append the event and apply its projection on the same transactional
   * connection, so the event log and read model commit atomically.
   */
  private async appendAndProject(
    tx: DbExecutor,
    input: IActivityEventInput,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    const event = await this.activityEvents.append(input, ctx, tx);
    await this.projector.apply(event, ctx, tx);
    await this.taskProjector.apply(event, ctx, tx);
    return event;
  }

  private async assertValidTransition(
    subjectType: 'initiative' | 'task',
    subjectId: number,
    eventType: IActivityEventInput['type'],
    ctx: IDBConfigOptions,
  ): Promise<void> {
    const allowed = LIFECYCLE_TRANSITIONS[eventType];
    if (!allowed) return;

    const current =
      subjectType === 'initiative'
        ? await this.initiativeStateRepo.findByInitiativeId(subjectId, ctx)
        : await this.taskStateRepo.findByTaskId(subjectId, ctx);

    const currentStatus = current?.status ?? 'not_started';
    if (!allowed.includes(currentStatus)) {
      AppException.throw(
        'VALIDATION_FAILED',
        `Cannot '${eventType}' a ${subjectType} that is currently '${currentStatus}'`,
      );
    }
  }

  /** Notify decoupled, non-critical listeners after the write has committed. */
  private notify(event: IActivityEventEntity, ctx: IDBConfigOptions): void {
    this.eventEmitter.emit(ACTIVITY_EVENT_EMITTED, { event, ctx });
  }

  private async emit(
    input: IActivityEventInput,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    const event = await this.dbProvider.withTenantTransaction(ctx, (tx) =>
      this.appendAndProject(tx, input, ctx),
    );
    this.notify(event, ctx);
    return event;
  }

  /** Emit a lifecycle event for any subject type — validates the transition first. */
  private async emitLifecycle(
    subjectType: 'initiative' | 'task',
    subjectId: number,
    type: IActivityEventInput['type'],
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition(subjectType, subjectId, type, ctx);
    return this.emit({ subjectType, subjectId, type, actorPersonId: actorId, payload }, ctx);
  }

  async start(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'started', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'started', actorPersonId: actorId, payload }, ctx);
  }

  async pause(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'paused', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'paused', actorPersonId: actorId, payload }, ctx);
  }

  async resume(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'resumed', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'resumed', actorPersonId: actorId, payload }, ctx);
  }

  async block(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'blocked', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'blocked', actorPersonId: actorId, payload }, ctx);
  }

  async unblock(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'unblocked', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'unblocked', actorPersonId: actorId, payload }, ctx);
  }

  async complete(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'completed', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'completed', actorPersonId: actorId, payload }, ctx);
  }

  async cancel(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    await this.assertValidTransition('initiative', initiativeId, 'cancelled', ctx);
    return this.emit({ subjectType: 'initiative', subjectId: initiativeId, type: 'cancelled', actorPersonId: actorId, payload }, ctx);
  }

  async logTime(
    initiativeId: number,
    actorId: number,
    minutes: number,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      { subjectType: 'initiative', subjectId: initiativeId, type: 'time_logged', actorPersonId: actorId, payload: { minutes } },
      ctx,
    );
  }

  async startTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'started', actorId, ctx, payload);
  }
  async pauseTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'paused', actorId, ctx, payload);
  }
  async resumeTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'resumed', actorId, ctx, payload);
  }
  async blockTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'blocked', actorId, ctx, payload);
  }
  async unblockTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'unblocked', actorId, ctx, payload);
  }
  async completeTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'completed', actorId, ctx, payload);
  }
  async cancelTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'cancelled', actorId, ctx, payload);
  }
  async logTaskTime(taskId: number, actorId: number, minutes: number, ctx: IDBConfigOptions) {
    return this.emitLifecycle('task', taskId, 'time_logged', actorId, ctx, { minutes });
  }

  async recordReason(
    subjectType: 'initiative',
    subjectId: number,
    actorId: number,
    { reason, reasonClass }: { reason: string; reasonClass?: string },
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType,
        subjectId,
        type: 'reason_recorded',
        actorPersonId: actorId,
        payload: { reason, reasonClass },
      },
      ctx,
    );
  }

  async recordOutcome(
    initiativeId: number,
    actorId: number,
    { result }: { result: string },
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'outcome_recorded',
        actorPersonId: actorId,
        payload: { result },
      },
      ctx,
    );
  }

  async measureKeyResult(
    keyResultId: number,
    actorId: number,
    value: string,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    const event = await this.dbProvider.withTenantTransaction(ctx, async (tx) => {
      const ev = await this.appendAndProject(
        tx,
        {
          subjectType: 'key_result',
          subjectId: keyResultId,
          type: 'key_result_measured',
          actorPersonId: actorId,
          payload: { value },
        },
        ctx,
      );
      await this.measurements.add(keyResultId, value, ev.occurredAt, ev.id, ctx, tx);
      await this.keyResults.updateCurrentValue(keyResultId, value, ctx, tx);
      return ev;
    });
    this.notify(event, ctx);
    return event;
  }
}
