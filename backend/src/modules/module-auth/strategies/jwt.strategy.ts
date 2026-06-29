import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { DbContextService } from 'src/infra/application-db/db-context';
import { cacheKey, CACHE_TTL_SHORT } from 'src/infra/cache/cache.constants';
import { PersonAccountRepository } from '../account.repo';
import { IPersonRecord } from '../auth.interface';
import { IUserSession } from '../current-user-module/session.interface';

interface IAccessTokenPayload {
  id: number;
  slug: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly accounts: PersonAccountRepository,
    private readonly ctx: DbContextService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: IAccessTokenPayload): Promise<IUserSession> {
    // Cache-aside: this runs on EVERY authenticated request. Short TTL so a
    // deactivation/role change (which busts the key via PersonService) takes
    // effect promptly; stale window is at most CACHE_TTL_SHORT.
    const dbCtx = this.ctx.system();
    const key = cacheKey.account(dbCtx.schema_id, payload.id);

    let person = await this.cache.get<IPersonRecord>(key);
    if (!person) {
      person = (await this.accounts.findById(payload.id, dbCtx)) ?? undefined;
      if (person) await this.cache.set(key, person, CACHE_TTL_SHORT);
    }

    if (!person || person.isDeleted || !person.isActive) {
      AppException.throw('UNAUTHORIZED', 'Account is not active');
    }
    return {
      id: person!.id,
      slug: person!.slug,
      email: person!.email,
      role: person!.role,
      departmentId: person!.departmentId ?? null,
      teamId: person!.teamId ?? null,
    };
  }
}
