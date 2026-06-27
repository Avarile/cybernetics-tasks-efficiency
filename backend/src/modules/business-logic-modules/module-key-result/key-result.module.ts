import { Module } from '@nestjs/common';
import { KeyResultController } from './key-result.controller';
import { KeyResultRepository } from './key-result.repo';
import { KeyResultService } from './key-result.service';

@Module({
  controllers: [KeyResultController],
  providers: [KeyResultRepository, KeyResultService],
  exports: [KeyResultRepository, KeyResultService],
})
export class KeyResultModule {}
