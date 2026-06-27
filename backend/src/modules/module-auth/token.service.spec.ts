jest.mock('src/utils/env', () => ({
  default: { JWT_SECRET: 'test-secret', JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' },
}));
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
  const svc = new TokenService(jwt);

  it('signs a verifiable access token carrying the session claims', () => {
    const token = svc.signAccessToken({ id: 1, slug: 's', email: 'e@x.com', role: 'member' } as any);
    const decoded = jwt.verify(token) as any;
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe('e@x.com');
    expect(decoded.role).toBe('member');
  });

  it('generates a refresh token whose stored hash is the sha256 of the raw value', () => {
    const { raw, hash } = svc.generateRefreshToken();
    expect(raw).toEqual(expect.any(String));
    expect(hash).toHaveLength(64); // sha256 hex
    expect(svc.hashRefresh(raw)).toBe(hash);
  });

  it('computes a refresh expiry roughly 7 days out', () => {
    const ms = svc.refreshTtlMs();
    expect(ms).toBe(7 * 24 * 60 * 60 * 1000);
    expect(new Date(svc.refreshExpiryIso()).getTime()).toBeGreaterThan(Date.now());
  });
});
