import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import env from 'src/utils/env';
import { IUserSession } from './current-user-module/session.interface';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(user: IUserSession): string {
    return this.jwt.sign({
      id: user.id,
      slug: user.slug,
      email: user.email,
      role: user.role,
    });
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hashRefresh(raw) };
  }

  hashRefresh(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshTtlMs(): number {
    return this.ttlToMs(env.JWT_REFRESH_TTL);
  }

  refreshExpiryIso(): string {
    return new Date(Date.now() + this.refreshTtlMs()).toISOString();
  }

  private ttlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
    return n * mult;
  }
}
