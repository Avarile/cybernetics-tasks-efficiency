import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentRepository } from './department.repo';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentRepository],
  exports: [DepartmentRepository],
})
export class DepartmentModule {}
