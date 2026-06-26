import { Module } from '@nestjs/common';
import { AuthModule } from './module-auth/auth.module';
import { PersonModule } from './business-logic-modules/module-person/person.module';
import { OrganizationModule } from './business-logic-modules/module-organization/organization.module';
import { DepartmentModule } from './business-logic-modules/module-department/department.module';
import { TeamModule } from './business-logic-modules/module-team/team.module';

@Module({ imports: [AuthModule, PersonModule, OrganizationModule, DepartmentModule, TeamModule] })
export class MainModule {}
