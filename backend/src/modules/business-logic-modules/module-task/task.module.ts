import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repo';
import { TaskService } from './task.service';
import { InitiativeModule } from '../module-initiative/initiative.module';
import { PersonRepository } from '../module-person/person.repo';
import { LabelModule } from '../module-label/label.module';
import { KnowledgeModule } from '../module-knowledge/knowledge.module';

@Module({
  imports: [InitiativeModule, LabelModule, KnowledgeModule],
  controllers: [TaskController],
  // PersonRepository provided directly to avoid pulling PersonModule's AuthModule → CACHE_MANAGER chain
  providers: [TaskRepository, TaskService, PersonRepository],
  exports: [TaskRepository, TaskService],
})
export class TaskModule {}
