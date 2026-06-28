import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repo';
import { TaskService } from './task.service';

@Module({
  controllers: [TaskController],
  providers: [TaskRepository, TaskService],
  exports: [TaskRepository, TaskService],
})
export class TaskModule {}
