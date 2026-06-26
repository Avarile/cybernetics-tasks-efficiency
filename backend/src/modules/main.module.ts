import { Module } from '@nestjs/common';
import { AuthModule } from './module-auth/auth.module';
import { PersonModule } from './business-logic-modules/module-person/person.module';
import { OrganizationModule } from './business-logic-modules/module-organization/organization.module';
import { DepartmentModule } from './business-logic-modules/module-department/department.module';
import { TeamModule } from './business-logic-modules/module-team/team.module';
import { ObjectiveModule } from './business-logic-modules/module-objective/objective.module';
import { KeyResultModule } from './business-logic-modules/module-key-result/key-result.module';

@Module({ imports: [AuthModule, PersonModule, OrganizationModule, DepartmentModule, TeamModule, ObjectiveModule, KeyResultModule] })
export class MainModule {}
