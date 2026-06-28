import env from 'src/utils/env';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from 'src/modules/module-auth/account.repo';
import { PasswordService } from 'src/modules/module-auth/password.service';

/**
 * Idempotent admin seeder — safe to run multiple times.
 * Creates the admin account from env if not already present.
 * NOT wired into module boot; invoke only via `yarn seed:admin`.
 */
export async function seedAdmin(): Promise<void> {
  const dbProvider = new ApplicationDBProvider();
  const ctxService = new DbContextService();
  const repo = new PersonAccountRepository(dbProvider);
  const passwords = new PasswordService();

  const sys = ctxService.system();

  const existing = await repo.findByEmail(env.ADMIN_ACCOUNT, sys);
  if (existing) {
    console.log(`Admin account already exists: ${env.ADMIN_ACCOUNT}`);
    return;
  }

  const passwordHash = await passwords.hash(env.ADMIN_ACCOUNT_PASSWORD);
  await repo.createPerson(
    {
      name: 'Admin',
      email: env.ADMIN_ACCOUNT,
      passwordHash,
      role: 'admin',
    },
    sys,
  );

  console.log(`Admin account created: ${env.ADMIN_ACCOUNT}`);
}
