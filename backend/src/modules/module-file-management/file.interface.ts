import { DefaultFields, IBaseQueryParams, UpdatableDefaultFields } from 'src/utils/shared/interface';

export enum FilePurpose {
  General = 'general',
  Public = 'public',
}

export interface IPresignParams {
  contentType: string;
  contentLength: number;
  expiresIn?: number;
  hash?: string;
  internal?: boolean;
}

export interface IPresignRes {
  token: string;
  path: string;
  url: string;
  uploadMethod: string;
  requestHeaders: Record<string, unknown>;
}

export interface IObjectMeta {
  size: number;
  mimetype: string;
  hash: string;
  url: string;
  width?: number;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IRespHeaders = Record<string, any>;

export interface IAttachmentProfile {
  token: string;
  bucket: string;
  path: string;
  hash: string;
  size: number;
  mimetype: string;
  width?: number | null;
  height?: number | null;
  thumbnailPath?: string | null;
  purpose: FilePurpose;
  createdByPersonId: number;
}

export interface INewAttachment extends IAttachmentProfile {}

export interface IUpdateAttachment
  extends Partial<Omit<IAttachmentProfile, 'createdByPersonId'>>,
    UpdatableDefaultFields {}

export interface IAttachmentEntity extends DefaultFields, IAttachmentProfile {
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
}

export interface IQueryAttachmentParams
  extends Partial<IAttachmentProfile>,
    Partial<IBaseQueryParams> {}

export interface INotifyResult {
  token: string;
  slug: string;
  path: string;
  size: number;
  mimetype: string;
  width?: number | null;
  height?: number | null;
  url: string;
  presignedUrl: string;
}
