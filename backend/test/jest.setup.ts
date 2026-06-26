// Loads backend/.env (gitignored, controller-provided) so env.ts can parse the
// required secrets and repo/e2e specs receive real DB credentials.
import 'dotenv/config';
