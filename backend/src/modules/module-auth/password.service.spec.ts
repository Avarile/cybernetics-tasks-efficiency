jest.mock('src/utils/env', () => ({ default: { APP_SALT_ROUNDS: 10 } }));
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes to a non-plaintext value that verifies', async () => {
    const hash = await svc.hash('secret123');
    expect(hash).not.toBe('secret123');
    expect(await svc.compare('secret123', hash)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const hash = await svc.hash('secret123');
    expect(await svc.compare('nope', hash)).toBe(false);
  });
});
