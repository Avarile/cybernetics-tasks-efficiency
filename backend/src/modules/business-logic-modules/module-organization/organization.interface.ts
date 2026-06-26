import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface IOrganizationProfile {
  name: string;
  description?: string | null;
}

export interface INewOrganization extends IOrganizationProfile {}

export interface IUpdateOrganization
  extends Partial<IOrganizationProfile>,
    UpdatableDefaultFields {}

export interface IQueryOrganizationParams
  extends Partial<IOrganizationProfile>,
    Partial<IBaseQueryParams> {}

export interface IOrganizationEntity extends DefaultFields, IOrganizationProfile {}

export interface IDeleteOrganization extends IGetByID {}
