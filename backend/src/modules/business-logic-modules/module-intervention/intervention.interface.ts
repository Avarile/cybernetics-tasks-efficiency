import {
  DefaultFields,
  IBaseQueryParams,
  IGetByID,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export type InterventionStatus = 'planned' | 'active' | 'measuring' | 'concluded';

export interface IInterventionProfile {
  title: string;
  description?: string | null;
  decidedByPersonId: number;
  startedAt: string;
  scope: string;
  hypothesis?: string | null;
  measurementWindowDays?: number;
}

export interface INewIntervention extends IInterventionProfile {}

export interface IUpdateIntervention extends Partial<IInterventionProfile>, UpdatableDefaultFields {
  status?: InterventionStatus;
}

export interface IQueryInterventionParams
  extends Partial<IInterventionProfile>,
    Partial<IBaseQueryParams> {
  status?: InterventionStatus;
}

export interface IInterventionEntity extends DefaultFields, IInterventionProfile {
  status: InterventionStatus;
  measurementWindowDays: number;
}

export interface IDeleteIntervention extends IGetByID {}
