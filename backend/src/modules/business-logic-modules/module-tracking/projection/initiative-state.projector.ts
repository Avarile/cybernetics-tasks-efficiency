import { Injectable } from '@nestjs/common';
import { DbExecutor } from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IActivityEventEntity } from '../tracking.interface';
import { InitiativeStateRepository } from './initiative-state.repo';

/**
 * Projects activity events onto the initiative read model. `apply` is invoked
 * synchronously by TrackingService inside the same transaction that appends
 * the event, so the event log and this projection can never diverge. It is
 * intentionally NOT wired as an `@OnEvent` listener — that ran on a separate
 * connection and broke atomicity.
 */
@Injectable()
export class InitiativeStateProjector {
  constructor(private readonly repo: InitiativeStateRepository) {}

  async apply(
    event: IActivityEventEntity,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
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
          executor,
        );
        break;

      case 'resumed':
      case 'unblocked':
        await this.repo.upsert(
          event.subjectId,
          { status: 'in_progress', blockedSince: null, ...baseFields },
          ctx,
          executor,
        );
        break;

      case 'paused':
        await this.repo.upsert(
          event.subjectId,
          { status: 'paused', ...baseFields },
          ctx,
          executor,
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
          executor,
        );
        break;

      case 'completed':
        await this.repo.upsert(
          event.subjectId,
          { status: 'completed', ...baseFields },
          ctx,
          executor,
        );
        break;

      case 'cancelled':
        await this.repo.upsert(
          event.subjectId,
          { status: 'cancelled', ...baseFields },
          ctx,
          executor,
        );
        break;

      case 'time_logged': {
        const current = await this.repo.findByInitiativeId(
          event.subjectId,
          ctx,
          executor,
        );
        const existing = current?.totalTimeLoggedMinutes ?? 0;
        const added = Number(event.payload?.minutes ?? 0);
        await this.repo.upsert(
          event.subjectId,
          { totalTimeLoggedMinutes: existing + added, ...baseFields },
          ctx,
          executor,
        );
        break;
      }

      // created / reason_recorded / outcome_recorded / note_added / key_result_measured
      default:
        // No status change — only update lastEventAt
        await this.repo.upsert(event.subjectId, { ...baseFields }, ctx, executor);
        break;
    }
  }
}
