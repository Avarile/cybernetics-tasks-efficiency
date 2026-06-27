import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonRepository } from './person.repo';

@Module({
  controllers: [PersonController],
  providers: [PersonRepository],
  exports: [PersonRepository],
})
export class PersonModule {}
