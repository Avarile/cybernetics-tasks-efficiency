import { alignableType } from 'src/infra/application-db/schema/okr.schema';

/**
 * The closed set of entity kinds that can be endpoints of an alignment edge.
 * Single source of truth: derived from the `alignable_type` Postgres enum, so
 * the application-layer validation and the DB constraint can never drift.
 */
export const ALIGNABLE_TYPES = alignableType.enumValues;

export type AlignableType = (typeof ALIGNABLE_TYPES)[number];
