export type ActivityEventType =
  | 'created'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'blocked'
  | 'unblocked'
  | 'cancelled'
  | 'completed'
  | 'time_logged'
  | 'reason_recorded'
  | 'outcome_recorded'
  | 'note_added'
  | 'key_result_measured';

export interface IActivityEventInput {
  occurredAt?: string;
  actorPersonId: number;
  subjectType: 'initiative' | 'key_result' | 'objective';
  subjectId: number;
  type: ActivityEventType;
  payload?: Record<string, unknown>;
  source?: 'human' | 'agent' | 'integration';
  confidence?: number | null;
  rawInputId?: number | null;
  correlationId?: string | null;
}

export interface IActivityEventEntity {
  id: number;
  slug: string;
  occurredAt: string;
  recordedAt: string | null;
  actorPersonId: number;
  subjectType: string;
  subjectId: number;
  type: ActivityEventType;
  payload: Record<string, unknown>;
  source: string;
  confidence: string | null;
  rawInputId: number | null;
  correlationId: string | null;
}
