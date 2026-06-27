import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamRepository } from './team.repo';

@Module({
  controllers: [TeamController],
  providers: [TeamRepository],
  exports: [TeamRepository],
})
export class TeamModule {}
