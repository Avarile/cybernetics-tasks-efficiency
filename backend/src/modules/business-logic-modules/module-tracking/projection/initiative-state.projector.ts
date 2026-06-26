import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IActivityEventEntity } from '../tracking.interface';
import {
  ACTIVITY_EVENT_EMITTED,
  ActivityEventEmitted,
} from '../tracking.events';
import { InitiativeStateRepository } from './initiative-state.repo';

@Injectable()
export class InitiativeStateProjector {
  constructor(private readonly repo: InitiativeStateRepository) {}

  async apply(
    event: IActivityEventEntity,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    if (event.subjectType !== 'initiative') {
      return;
    }

    const baseFields = { lastEventAt: event.occurredAt };

    switch (event.type) {
      case 'started':
        await this.repo.upsert(
          event.subjectId,
          { status: 'in_progress', ...baseFields },
          ctx,
        );
        break;

      case 'resumed':
      case 'unblocked':
        await this.repo.upsert(
          event.subjectId,
          { status: 'in_progress', blockedSince: null, ...baseFields },
          ctx,
        );
        break;

      case 'paused':
        await this.repo.upsert(
          event.subjectId,
          { status: 'paused', ...baseFields },
          ctx,
        );
        break;

      case 'blocked':
        await this.repo.upsert(
          event.subjectId,
          {
            status: 'blocked',
            blockedSince: event.occurredAt,
            ...baseFields,
          },
          ctx,
        );
        break;

      case 'completed':
        await this.repo.upsert(
          event.subjectId,
          { status: 'completed', ...baseFields },
          ctx,
        );
        break;

      case 'cancelled':
        await this.repo.upsert(
          event.subjectId,
          { status: 'cancelled', ...baseFields },
          ctx,
        );
        break;

      case 'time_logged': {
        const current = await this.repo.findByInitiativeId(
          event.subjectId,
          ctx,
        );
        const existing = current?.totalTimeLoggedMinutes ?? 0;
        const added = Number(event.payload?.minutes ?? 0);
        await this.repo.upsert(
          event.subjectId,
          { totalTimeLoggedMinutes: existing + added, ...baseFields },
          ctx,
        );
        break;
      }

      // created / reason_recorded / outcome_recorded / note_added / key_result_measured
      default:
        // No status change — only update lastEventAt
        await this.repo.upsert(event.subjectId, { ...baseFields }, ctx);
        break;
    }
  }

  @OnEvent(ACTIVITY_EVENT_EMITTED)
  async handle(payload: ActivityEventEmitted): Promise<void> {
    await this.apply(payload.event, payload.ctx);
  }
}
