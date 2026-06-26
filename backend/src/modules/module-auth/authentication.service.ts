import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { PersonAccountRepository } from './account.repo';
import { DbContextService } from 'src/infra/application-db/db-context';
import { Role } from 'src/middleware/roles.decorator';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly accounts: PersonAccountRepository,
    private readonly ctx: DbContextService,
  ) {}

  async register(input: { name: string; email: string; password: string; role?: Role }) {
    const sys = this.ctx.system();
    const existing = await this.accounts.findByEmail(input.email, sys);
    if (existing) AppException.throw('RESOURCE_CONFLICT', 'Email already registered');
    const passwordHash = await bcrypt.hash(input.password, env.APP_SALT_ROUNDS);
    const person = await this.accounts.createPerson(
      {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role ?? 'member',
      },
      sys,
    );
    return this.issue(person);
  }

  async login(email: string, password: string) {
    const person = await this.accounts.findByEmail(email, this.ctx.system());
    if (!person || !person.passwordHash) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    const ok = await bcrypt.compare(password, person.passwordHash!);
    if (!ok) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    return this.issue(person);
  }

  private issue(person: { id: number; slug: string; email: string; role: string }) {
    const payload = { id: person.id, slug: person.slug, email: person.email, role: person.role };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    return { token, user: payload };
  }
}
