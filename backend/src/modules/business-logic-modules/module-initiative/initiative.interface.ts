import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IInitiativeProfile {
  title: string;
  description?: string | null;
  ownerPersonId: number;
  priority: string;
  dueDate?: string | null;
}

export interface INewInitiative extends IInitiativeProfile {}

export interface IUpdateInitiative extends Partial<IInitiativeProfile>, UpdatableDefaultFields {}

export interface IQueryInitiativeParams extends Partial<IInitiativeProfile>, Partial<IBaseQueryParams> {}

export interface IInitiativeEntity extends DefaultFields, IInitiativeProfile {
  status: 'not_started' | 'in_progress' | 'blocked' | 'paused' | 'completed' | 'cancelled';
}

export interface IDeleteInitiative extends IGetByID {}
