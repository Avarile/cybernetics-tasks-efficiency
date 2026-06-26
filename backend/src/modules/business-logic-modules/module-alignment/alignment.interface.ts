import { DefaultFields } from 'src/utils/shared/interface';

export interface IAlignmentLinkProfile {
  fromType: string;
  fromId: number;
  toType: string;
  toId: number;
  weight?: string | null;
}

export interface INewAlignmentLink {
  fromType: string;
  fromId: number;
  toType: string;
  toId: number;
  weight?: string | null;
}

export interface IAlignmentLinkEntity extends DefaultFields, IAlignmentLinkProfile {}
