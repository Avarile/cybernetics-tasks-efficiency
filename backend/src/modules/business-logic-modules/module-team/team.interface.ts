import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface ITeamProfile {
  name: string;
  departmentId: number;
  leadPersonId?: number | null;
}

export interface INewTeam extends ITeamProfile {}

export interface IUpdateTeam extends Partial<ITeamProfile>, UpdatableDefaultFields {}

export interface IQueryTeamParams
  extends Partial<ITeamProfile>,
    Partial<IBaseQueryParams> {}

export interface ITeamEntity extends DefaultFields, ITeamProfile {}

export interface IDeleteTeam extends IGetByID {}
