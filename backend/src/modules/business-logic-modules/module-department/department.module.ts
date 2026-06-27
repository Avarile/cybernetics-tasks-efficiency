import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentRepository } from './department.repo';
import { DepartmentService } from './department.service';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentRepository, DepartmentService],
  exports: [DepartmentRepository, DepartmentService],
})
export class DepartmentModule {}
