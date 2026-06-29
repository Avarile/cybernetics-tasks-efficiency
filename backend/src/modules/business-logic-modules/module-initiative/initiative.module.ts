import { Module } from '@nestjs/common';
import { InitiativeController } from './initiative.controller';
import { InitiativeRepository } from './initiative.repo';
import { InitiativeService } from './initiative.service';
import { KeyResultModule } from '../module-key-result/key-result.module';

@Module({
  imports: [KeyResultModule],
  controllers: [InitiativeController],
  providers: [InitiativeRepository, InitiativeService],
  exports: [InitiativeRepository, InitiativeService],
})
export class InitiativeModule {}
