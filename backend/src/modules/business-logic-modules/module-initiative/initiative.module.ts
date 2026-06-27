import { Module } from '@nestjs/common';
import { InitiativeController } from './initiative.controller';
import { InitiativeRepository } from './initiative.repo';

@Module({
  controllers: [InitiativeController],
  providers: [InitiativeRepository],
  exports: [InitiativeRepository],
})
export class InitiativeModule {}
