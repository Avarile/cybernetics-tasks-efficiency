import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from '../account.repo';
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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: IAccessTokenPayload): Promise<IUserSession> {
    const person = await this.accounts.findById(payload.id, this.ctx.system());
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
