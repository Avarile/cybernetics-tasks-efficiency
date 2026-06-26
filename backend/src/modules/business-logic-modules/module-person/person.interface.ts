import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IPersonProfile {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
  departmentId?: number | null;
  teamId?: number | null;
}

export interface INewPerson extends IPersonProfile {
  passwordHash?: string | null;
}

export interface IUpdatePerson extends Partial<IPersonProfile>, UpdatableDefaultFields {}

export interface IQueryPersonParams extends Partial<IPersonProfile>, Partial<IBaseQueryParams> {}

export interface IPersonEntity extends DefaultFields, IPersonProfile {}

export interface IDeletePerson extends IGetByID {}
