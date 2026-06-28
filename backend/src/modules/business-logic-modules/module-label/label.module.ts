import { Module } from '@nestjs/common';
import { LabelController } from './label.controller';
import { LabelRepository } from './label.repo';
import { LabelService } from './label.service';

@Module({
  controllers: [LabelController],
  providers: [LabelRepository, LabelService],
  exports: [LabelRepository, LabelService],
})
export class LabelModule {}
