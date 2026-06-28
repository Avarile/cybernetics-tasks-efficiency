import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, PureAbility } from '@casl/ability';
import { AppAbility } from './ability.types';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

// Builder uses PureAbility<any> so condition values (plain numbers/strings)
// type-check correctly. The built result is cast to AppAbility for consumers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAbility = PureAbility<any, any>;

/**
 * Static per-role authorization rules. `manage` = all actions.
 * Conditions are matched against plain Drizzle rows tagged with `subject()`.
 */
export function defineAbilityFor(user: IUserSession): AppAbility {
  const { can, build } = new AbilityBuilder<AnyAbility>(createMongoAbility);

  switch (user.role) {
    case 'admin':
      can('manage', 'all');
      break;

    case 'executive':
      can('read', 'all');
      break;

    case 'manager':
      can('read', 'all');
      can('manage', 'Objective', { ownerPersonId: user.id });
      if (user.teamId) {
        can('manage', 'Objective', { scope: 'team', scopeRefId: user.teamId });
      }
      can('manage', 'KeyResult');
      can('manage', 'Initiative');
      can('manage', 'AlignmentLink');
      can('manage', 'Intervention', { decidedByPersonId: user.id });
      can('create', 'ActivityEvent', { actorPersonId: user.id });
      break;

    case 'member':
      can('read', [
        'Objective',
        'KeyResult',
        'AlignmentLink',
        'Intervention',
        'Organization',
        'Department',
        'Team',
        'Person',
      ]);
      can('manage', 'Initiative', { ownerPersonId: user.id });
      can('create', 'ActivityEvent', { actorPersonId: user.id });
      can('read', 'ActivityEvent', { actorPersonId: user.id });
      can('update', 'Person', { id: user.id });
      break;
  }

  return build() as AppAbility;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: IUserSession): AppAbility {
    return defineAbilityFor(user);
  }
}
