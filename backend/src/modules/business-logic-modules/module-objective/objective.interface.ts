import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IObjectiveProfile {
  title: string;
  description?: string | null;
  ownerPersonId: number;
  scope: 'org' | 'department' | 'team';
  scopeRefId?: number | null;
  period: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
}

export interface INewObjective extends IObjectiveProfile {}

export interface IUpdateObjective extends Partial<IObjectiveProfile>, UpdatableDefaultFields {}

export interface IQueryObjectiveParams extends Partial<IObjectiveProfile>, Partial<IBaseQueryParams> {}

export interface IObjectiveEntity extends DefaultFields, IObjectiveProfile {
  ownerName?: string | null;
}

export interface IDeleteObjective extends IGetByID {}
