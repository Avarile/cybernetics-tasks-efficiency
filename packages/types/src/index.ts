export type UserRole = 'admin' | 'manager' | 'executive' | 'member';

export interface IAuthSession {
  id: number;
  slug: string;
  name?: string;
  email: string;
  role: UserRole;
  departmentId?: number | null;
  teamId?: number | null;
}

export interface IPerson {
  id: string;
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  position?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IOrganization {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IDepartment {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  leadPersonId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ITeam {
  id: string;
  slug: string;
  name: string;
  departmentId?: string | null;
  leadPersonId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  slug: string;
  name: string;
  color: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
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
