import { DefaultFields } from 'src/utils/shared/interface';
import { AlignableType } from './alignment.constants';

export interface IAlignmentLinkProfile {
  fromType: AlignableType;
  fromId: number;
  toType: AlignableType;
  toId: number;
  weight?: string | null;
}

export interface INewAlignmentLink {
  fromType: AlignableType;
  fromId: number;
  toType: AlignableType;
  toId: number;
  weight?: string | null;
}

export interface IAlignmentLinkEntity extends DefaultFields, IAlignmentLinkProfile {}
