import {
  DefaultFields,
  IBaseQueryParams,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export type TaskStatus =
  | 'not_started' | 'in_progress' | 'blocked' | 'paused' | 'completed' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface ITaskProfile {
  initiativeId: number;
  parentId?: number | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  startDate?: string | null;
  targetDate?: string | null;
  createdByPersonId: number;
}

export interface INewTask extends ITaskProfile {}

export interface IUpdateTask
  extends Partial<Omit<ITaskProfile, 'createdByPersonId'>>,
    UpdatableDefaultFields {
  completedAt?: string | null;
  sortOrder?: number;
}

export interface IQueryTaskParams extends Partial<ITaskProfile>, Partial<IBaseQueryParams> {
  status?: TaskStatus;
}

export interface ITaskEntity extends DefaultFields, ITaskProfile {
  completedAt: string | null;
  sortOrder: number;
  sequenceId: number | null;
  status: TaskStatus;
}

export interface ITaskSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
}
