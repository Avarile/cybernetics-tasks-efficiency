import 'dotenv/config';
import { seedAdmin } from 'src/infra/application-db/seeder/seeder-admin';

seedAdmin()
  .then(() => {
    console.log('Seeding complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
