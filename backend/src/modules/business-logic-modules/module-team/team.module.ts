import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamRepository } from './team.repo';
import { TeamService } from './team.service';

@Module({
  controllers: [TeamController],
  providers: [TeamRepository, TeamService],
  exports: [TeamRepository, TeamService],
})
export class TeamModule {}
