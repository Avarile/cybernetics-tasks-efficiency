import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { PersonController } from './person.controller';
import { PersonRepository } from './person.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [PersonController],
  providers: [PersonRepository],
  exports: [PersonRepository],
})
export class PersonModule {}
