import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IDepartmentProfile {
  name: string;
  description?: string | null;
  parentId?: number | null;
  leadPersonId?: number | null;
}

export interface INewDepartment extends IDepartmentProfile {}

export interface IUpdateDepartment
  extends Partial<IDepartmentProfile>,
    UpdatableDefaultFields {}

export interface IQueryDepartmentParams
  extends Partial<IDepartmentProfile>,
    Partial<IBaseQueryParams> {}

export interface IDepartmentEntity extends DefaultFields, IDepartmentProfile {}

export interface IDeleteDepartment extends IGetByID {}
