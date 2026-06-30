import { ForcedSubject, MongoQuery, PureAbility } from '@casl/ability';

export type AppAction = 'manage' | 'create' | 'read' | 'update' | 'delete';

export type AppSubjectName =
  | 'Organization'
  | 'Department'
  | 'Team'
  | 'Person'
  | 'Objective'
  | 'KeyResult'
  | 'Initiative'
  | 'AlignmentLink'
  | 'Intervention'
  | 'ActivityEvent'
  | 'Task'
  | 'Label'
  | 'Attachment'
  | 'Knowledge'
  | 'all';

/**
 * AppAbility includes both plain string subject names and tagged objects
 * produced by CASL's `subject()` helper for row-level condition checks.
 * Using PureAbility with MongoQuery<AnyObject> so condition values (plain
 * numbers, strings) type-check correctly with the mongo query matcher.
 */
export type AppSubject = AppSubjectName | (ForcedSubject<AppSubjectName> & object);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppAbility = PureAbility<[AppAction, AppSubject], MongoQuery<any>>;
