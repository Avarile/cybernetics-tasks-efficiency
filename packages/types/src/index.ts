export type UserRole = 'admin' | 'manager' | 'executive' | 'member';

export interface IAuthSession {
  id: number;
  slug: string;
  email: string;
  role: UserRole;
  departmentId?: number | null;
  teamId?: number | null;
}

export interface IPerson {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  avatarUrl?: string;
}

export interface IOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface IObjective {
  id: string;
  slug: string;
  title: string;
  ownerId: string;
  progress: number;
  status: string;
}

export interface IInitiative {
  id: string;
  slug: string;
  title: string;
  status: string;
  taskCount?: number;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface ITask {
  id: string;
  slug: string;
  sequenceId: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  initiativeId?: string;
  parentId?: string;
  assignees: IPerson[];
  labels: ILabel[];
}

export interface ILabel {
  id: string;
  name: string;
  color: string;
  organizationId: string;
}

export interface IKeyResult {
  id: string;
  slug: string;
  title: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  objectiveId: string;
}

export interface IKnowledge {
  id: string;
  slug: string;
  title: string;
  body: string;
  visibility: 'private' | 'shared' | 'organization';
  ownerId: string;
}

export interface IApiError {
  statusCode: number;
  message: string;
  error?: string;
}
