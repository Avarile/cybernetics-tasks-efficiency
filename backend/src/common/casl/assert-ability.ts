import { subject } from '@casl/ability';
import { AppAbility, AppAction, AppSubjectName } from './ability.types';
import { AppException } from 'src/utils/exception.provider';

/**
 * Assert that `ability` permits `action` on a specific persisted row, throwing
 * FORBIDDEN otherwise. Centralises the row-level CASL check so services — not
 * controllers — own authorization, and the entity cast lives in one place.
 */
export function assertAbility(
  ability: AppAbility,
  action: AppAction,
  subjectName: AppSubjectName,
  entity: object,
  message?: string,
): void {
  if (ability.cannot(action, subject(subjectName, entity as Record<string, unknown>))) {
    AppException.throw(
      'FORBIDDEN',
      message ?? `You cannot ${action} this ${subjectName.toLowerCase()}`,
    );
  }
}
