import { Module } from '@nestjs/common';
import { InitiativeController } from './initiative.controller';
import { InitiativeRepository } from './initiative.repo';
import { InitiativeService } from './initiative.service';

@Module({
  controllers: [InitiativeController],
  providers: [InitiativeRepository, InitiativeService],
  exports: [InitiativeRepository, InitiativeService],
})
export class InitiativeModule {}
