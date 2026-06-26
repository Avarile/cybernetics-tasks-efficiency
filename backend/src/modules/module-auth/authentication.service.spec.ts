import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthenticationService } from './authentication.service';
import { PersonAccountRepository } from './account.repo';
import { DbContextService } from 'src/infra/application-db/db-context';
import { AppException } from 'src/utils/exception.provider';

// Mock env so JWT_SECRET is deterministic in tests
jest.mock('src/utils/env', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '1d',
    APP_SALT_ROUNDS: 10,
    ADMIN_ACCOUNT: 'admin@test.com',
    ADMIN_ACCOUNT_PASSWORD: 'admin-pass',
    COMPANY_SCHEMA: 'public',
    DATABASE_MAIN_HOST: 'localhost',
    DATABASE_MAIN_PORT: 5432,
    DATABASE_MAIN_DATABASE: 'test',
    DATABASE_MAIN_USERNAME: 'postgres',
    DATABASE_MAIN_PASSWORD: 'postgres',
  },
}));

const SYS_CTX = { database_uri: 'postgresql://localhost/test', schema_id: 'public', user_id: 0 };

function makeRepo(): jest.Mocked<PersonAccountRepository> {
  return {
    findByEmail: jest.fn(),
    createPerson: jest.fn(),
    findById: jest.fn(),
  } as any;
}

function makeCtx(): jest.Mocked<DbContextService> {
  return { system: jest.fn().mockReturnValue(SYS_CTX), forUser: jest.fn() } as any;
}

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let repo: jest.Mocked<PersonAccountRepository>;
  let ctx: jest.Mocked<DbContextService>;

  beforeEach(() => {
    repo = makeRepo();
    ctx = makeCtx();
    service = new AuthenticationService(repo, ctx);
  });

  describe('register', () => {
    it('stores a bcrypt hash (not plaintext) and returns a JWT token string', async () => {
      let capturedHash: string | undefined;

      repo.findByEmail.mockResolvedValue(null);
      repo.createPerson.mockImplementation(async (dto) => {
        capturedHash = dto.passwordHash;
        return {
          id: 1,
          slug: 'slug-abc',
          email: dto.email,
          role: dto.role ?? 'member',
          passwordHash: dto.passwordHash,
        } as any;
      });

      const result = await service.register({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

      // Hash must not be the plaintext password
      expect(capturedHash).toBeDefined();
      expect(capturedHash).not.toBe('secret123');
      // Stored hash must verify against the original password
      expect(await bcrypt.compare('secret123', capturedHash!)).toBe(true);

      // Must return a JWT token string
      expect(typeof result.token).toBe('string');
      const decoded = jwt.verify(result.token, 'test-secret-key') as any;
      expect(decoded.email).toBe('alice@example.com');
    });

    it('throws RESOURCE_CONFLICT when email already exists', async () => {
      repo.findByEmail.mockResolvedValue({ id: 2, email: 'taken@example.com' } as any);

      await expect(
        service.register({ name: 'Bob', email: 'taken@example.com', password: 'pass' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    });
  });

  describe('login', () => {
    it('returns a JWT token when credentials are correct', async () => {
      const passwordHash = await bcrypt.hash('correct-pass', 10);
      repo.findByEmail.mockResolvedValue({ id: 3, slug: 'slug-xyz', email: 'user@example.com', role: 'member', passwordHash } as any);

      const result = await service.login('user@example.com', 'correct-pass');

      expect(typeof result.token).toBe('string');
      const decoded = jwt.verify(result.token, 'test-secret-key') as any;
      expect(decoded.email).toBe('user@example.com');
    });

    it('throws UNAUTHORIZED when password is wrong', async () => {
      const passwordHash = await bcrypt.hash('correct-pass', 10);
      repo.findByEmail.mockResolvedValue({ id: 3, slug: 'slug-xyz', email: 'user@example.com', role: 'member', passwordHash } as any);

      await expect(
        service.login('user@example.com', 'wrong-pass'),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('throws UNAUTHORIZED when email not found', async () => {
      repo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('nobody@example.com', 'any-pass'),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });
});
