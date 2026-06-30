import { DefaultFields, IBaseQueryParams, UpdatableDefaultFields } from 'src/utils/shared/interface';

export type KnowledgeVisibility = 'private' | 'shared' | 'organization';

export interface IKnowledgeProfile {
  title: string;
  body?: string | null;
  ownerPersonId: number;
  visibility: KnowledgeVisibility;
}

export interface INewKnowledge {
  title: string;
  body?: string | null;
  ownerPersonId: number;
  visibility?: KnowledgeVisibility;
}

export interface IUpdateKnowledge
  extends Partial<Pick<IKnowledgeProfile, 'title' | 'body' | 'visibility'>>,
    UpdatableDefaultFields {}

export interface IKnowledgeEntity extends DefaultFields, IKnowledgeProfile {
  body: string | null;
}

export interface IQueryKnowledgeParams extends Partial<IBaseQueryParams> {
  title?: string;
  ownerPersonId?: number;
  visibility?: KnowledgeVisibility;
  // Authorization-aware filtering, computed by the service before querying.
  requesterId?: number;
  sharedIds?: number[];
  unrestricted?: boolean;
}

export interface IKnowledgeLink {
  id: number;
  knowledgeId: number;
  url: string;
  title: string | null;
}

export interface IKnowledgeAttachmentRef {
  id: number;
  slug: string;
  url: string;
  mimetype: string;
  thumbnailPath: string | null;
}
