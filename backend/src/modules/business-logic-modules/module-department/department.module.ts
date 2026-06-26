import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { DepartmentController } from './department.controller';
import { DepartmentRepository } from './department.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [DepartmentController],
  providers: [DepartmentRepository],
  exports: [DepartmentRepository],
})
export class DepartmentModule {}
