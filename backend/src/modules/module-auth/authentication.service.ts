import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from './account.repo';
import { AuthSessionRepository } from './auth-session.repo';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { IUserSession } from './current-user-module/session.interface';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly accounts: PersonAccountRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly ctx: DbContextService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<IUserSession> {
    const person = await this.accounts.findByEmail(email, this.ctx.system());
    if (!person || !person.passwordHash) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    const ok = await this.passwords.compare(password, person!.passwordHash!);
    if (!ok) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    return this.toSession(person!);
  }

  async login(user: IUserSession, req: Request, res: Response): Promise<{ accessToken: string; user: IUserSession }> {
    const accessToken = this.tokens.signAccessToken(user);
    await this.issueRefreshSession(user.id, req, res);
    return { accessToken, user };
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
    if (!raw) AppException.throw('UNAUTHORIZED', 'Missing refresh token');

    const sys = this.ctx.system();
    const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(raw), sys);
    if (!session) AppException.throw('UNAUTHORIZED', 'Invalid refresh token');

    const person = await this.accounts.findById(session!.personId, sys);
    if (!person || person.isDeleted || !person.isActive) {
      await this.sessions.revoke(session!.id, sys);
      this.clearRefreshCookie(res);
      AppException.throw('UNAUTHORIZED', 'Account is not active');
    }

    // rotate: revoke the presented session, issue a fresh pair
    await this.sessions.revoke(session!.id, sys);
    const user = this.toSession(person!);
    const accessToken = this.tokens.signAccessToken(user);
    await this.issueRefreshSession(user.id, req, res);
    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
    if (raw) {
      const sys = this.ctx.system();
      const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(raw), sys);
      if (session) await this.sessions.revoke(session.id, sys);
    }
    this.clearRefreshCookie(res);
  }

  private async issueRefreshSession(personId: number, req: Request, res: Response): Promise<void> {
    const { raw, hash } = this.tokens.generateRefreshToken();
    await this.sessions.create(
      {
        personId,
        refreshTokenHash: hash,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        ipAddress: req.ip ?? null,
        expiresAt: this.tokens.refreshExpiryIso(),
      },
      this.ctx.system(),
    );
    this.setRefreshCookie(res, raw);
  }

  private toSession(p: {
    id: number; slug: string; email: string;
    role: 'admin' | 'manager' | 'member' | 'executive';
    departmentId?: number | null; teamId?: number | null;
  }): IUserSession {
    return {
      id: p.id, slug: p.slug, email: p.email, role: p.role,
      departmentId: p.departmentId ?? null, teamId: p.teamId ?? null,
    };
  }

  private setRefreshCookie(res: Response, raw: string): void {
    res.cookie(env.REFRESH_COOKIE_NAME, raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      path: '/api/auth',
      maxAge: this.tokens.refreshTtlMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(env.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      path: '/api/auth',
    });
  }
}
