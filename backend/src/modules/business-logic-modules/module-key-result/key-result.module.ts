import { Module } from '@nestjs/common';
import { KeyResultController } from './key-result.controller';
import { KeyResultRepository } from './key-result.repo';

@Module({
  controllers: [KeyResultController],
  providers: [KeyResultRepository],
  exports: [KeyResultRepository],
})
export class KeyResultModule {}
