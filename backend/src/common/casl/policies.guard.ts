import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './policy.types';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!handlers?.length) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.user) AppException.throw('UNAUTHORIZED', 'Authentication required');

    const ability = this.caslFactory.createForUser(req.user);
    req.ability = ability; // cached for @CurrentAbility() row-level checks

    const ok = handlers.every((handler) => handler(ability));
    if (!ok) AppException.throw('FORBIDDEN', 'Insufficient permissions');
    return true;
  }
}
