import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { ActivityEventRepository } from './activity-event.repo';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import {
  ACTIVITY_EVENT_EMITTED,
} from './tracking.events';
import {
  IActivityEventInput,
  IActivityEventEntity,
} from './tracking.interface';

@Injectable()
export class TrackingService {
  constructor(
    private readonly activityEvents: ActivityEventRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly measurements: KeyResultMeasurementRepository,
    private readonly keyResults: KeyResultRepository,
    private readonly dbProvider: ApplicationDBProvider,
    private readonly projector: InitiativeStateProjector,
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
    return event;
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

  async start(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'started',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async pause(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'paused',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async resume(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'resumed',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async block(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'blocked',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async unblock(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'unblocked',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async complete(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'completed',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async cancel(
    initiativeId: number,
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'cancelled',
        actorPersonId: actorId,
        payload,
      },
      ctx,
    );
  }

  async logTime(
    initiativeId: number,
    actorId: number,
    minutes: number,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    return this.emit(
      {
        subjectType: 'initiative',
        subjectId: initiativeId,
        type: 'time_logged',
        actorPersonId: actorId,
        payload: { minutes },
      },
      ctx,
    );
  }

  async recordReason(
    subjectType: 'initiative' | 'key_result' | 'objective',
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
