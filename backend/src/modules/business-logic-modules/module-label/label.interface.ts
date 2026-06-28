import {
  DefaultFields,
  IBaseQueryParams,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface ILabelProfile {
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: number | null;
  sortOrder?: number;
}

export interface INewLabel extends ILabelProfile {}
export interface IUpdateLabel extends Partial<ILabelProfile>, UpdatableDefaultFields {}
export interface IQueryLabelParams extends Partial<ILabelProfile>, Partial<IBaseQueryParams> {}
export interface ILabelEntity extends DefaultFields, ILabelProfile {}
