import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppAbility } from './ability.types';
import { defineAbilityFor } from './ability.factory';

/** Returns the request's CASL ability (built by PoliciesGuard, or lazily here). */
export const CurrentAbility = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AppAbility => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.ability) req.ability = defineAbilityFor(req.user);
    return req.ability;
  },
);
