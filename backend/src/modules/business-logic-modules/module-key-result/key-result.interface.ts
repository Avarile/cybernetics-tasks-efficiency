import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IKeyResultProfile {
  objectiveId: number;
  title: string;
  metricType: 'number' | 'percent' | 'currency' | 'boolean';
  unit?: string | null;
  startValue?: string | null;
  targetValue?: string | null;
  currentValue?: string | null;
  direction: 'increase' | 'decrease';
}

export interface INewKeyResult extends IKeyResultProfile {}

export interface IUpdateKeyResult extends Partial<IKeyResultProfile>, UpdatableDefaultFields {}

export interface IQueryKeyResultParams extends Partial<IKeyResultProfile>, Partial<IBaseQueryParams> {}

export interface IKeyResultEntity extends DefaultFields, IKeyResultProfile {}

export interface IDeleteKeyResult extends IGetByID {}
