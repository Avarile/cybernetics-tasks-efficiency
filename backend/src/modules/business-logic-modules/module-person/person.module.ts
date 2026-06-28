import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonRepository } from './person.repo';
import { PersonService } from './person.service';
import { AuthModule } from 'src/modules/module-auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PersonController],
  providers: [PersonRepository, PersonService],
  exports: [PersonRepository, PersonService],
})
export class PersonModule {}
