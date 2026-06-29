import { Injectable } from '@nestjs/common';
import { DbExecutor } from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IActivityEventEntity } from '../tracking.interface';
import { TaskStateRepository } from './task-state.repo';
import { TaskRepository } from '../../module-task/task.repo';

/**
 * Projects task activity events onto the task read model. `apply` runs inside
 * the same transaction that appends the event (invoked by TrackingService), so
 * the event log and this projection can never diverge. No-ops for any event
 * whose subjectType is not 'task'.
 *
 * Also keeps `task.status` (the denormalized cache column) in sync in the SAME
 * transaction so that OKR roll-ups (countByInitiative) and status-filtered
 * queries read honest data without requiring a join on task_state.
 */
@Injectable()
export class TaskStateProjector {
  constructor(
    private readonly repo: TaskStateRepository,
    private readonly taskRepo: TaskRepository,
  ) {}

  async apply(
    event: IActivityEventEntity,
    ctx: IDBConfigOptions,
    executor?: DbExecutor,
  ): Promise<void> {
    if (event.subjectType !== 'task') return;

    const baseFields = { lastEventAt: event.occurredAt };

    switch (event.type) {
      case 'started':
        await this.repo.upsert(
          event.subjectId,
          { status: 'in_progress', ...baseFields },
          ctx,
          executor,
        );
        await this.taskRepo.updateStatus(event.subjectId, 'in_progress', ctx, executor);
        break;

      case 'resumed':
      case 'unblocked':
        await this.repo.upsert(
          event.subjectId,
          { status: 'in_progress', blockedSince: null, ...baseFields },
          ctx,
          executor,
        );
        await this.taskRepo.updateStatus(event.subjectId, 'in_progress', ctx, executor);
        break;

      case 'paused':
        await this.repo.upsert(
          event.subjectId,
          { status: 'paused', ...baseFields },
          ctx,
          executor,
        );
        await this.taskRepo.updateStatus(event.subjectId, 'paused', ctx, executor);
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
        await this.taskRepo.updateStatus(event.subjectId, 'blocked', ctx, executor);
        break;

      case 'completed':
        await this.repo.upsert(
          event.subjectId,
          { status: 'completed', ...baseFields },
          ctx,
          executor,
        );
        await this.taskRepo.updateStatus(event.subjectId, 'completed', ctx, executor);
        await this.taskRepo.updateCompletedAt(event.subjectId, event.occurredAt, ctx, executor);
        break;

      case 'cancelled':
        await this.repo.upsert(
          event.subjectId,
          { status: 'cancelled', ...baseFields },
          ctx,
          executor,
        );
        await this.taskRepo.updateStatus(event.subjectId, 'cancelled', ctx, executor);
        break;

      case 'time_logged': {
        const added = Number(event.payload?.minutes ?? 0);
        await this.repo.addTime(event.subjectId, added, event.occurredAt, ctx, executor);
        break;
      }

      // created / reason_recorded / outcome_recorded / note_added — only touch lastEventAt
      default:
        await this.repo.upsert(event.subjectId, { ...baseFields }, ctx, executor);
        break;
    }
  }
}
