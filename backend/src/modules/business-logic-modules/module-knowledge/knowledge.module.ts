import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeRepository } from './knowledge.repo';
import { KnowledgeService } from './knowledge.service';
import { PersonRepository } from '../module-person/person.repo';
import { TaskRepository } from '../module-task/task.repo';
import { FileManagementModule } from 'src/modules/module-file-management/file.module';

@Module({
  imports: [FileManagementModule],
  controllers: [KnowledgeController],
  // PersonRepository/TaskRepository provided directly (each needs only the
  // global ApplicationDBProvider) to avoid importing PersonModule/TaskModule
  // and creating a cycle with TaskModule, which imports KnowledgeModule.
  providers: [KnowledgeRepository, KnowledgeService, PersonRepository, TaskRepository],
  exports: [KnowledgeService, KnowledgeRepository],
})
export class KnowledgeModule {}
