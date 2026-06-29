import { Module } from '@nestjs/common';
import { PersonModule } from './business-logic-modules/module-person/person.module';
import { OrganizationModule } from './business-logic-modules/module-organization/organization.module';
import { DepartmentModule } from './business-logic-modules/module-department/department.module';
import { TeamModule } from './business-logic-modules/module-team/team.module';
import { ObjectiveModule } from './business-logic-modules/module-objective/objective.module';
import { KeyResultModule } from './business-logic-modules/module-key-result/key-result.module';
import { InitiativeModule } from './business-logic-modules/module-initiative/initiative.module';
import { AlignmentModule } from './business-logic-modules/module-alignment/alignment.module';
import { TrackingModule } from './business-logic-modules/module-tracking/tracking.module';
import { InterventionModule } from './business-logic-modules/module-intervention/intervention.module';
import { LabelModule } from './business-logic-modules/module-label/label.module';
import { TaskModule } from './business-logic-modules/module-task/task.module';
import { AuthModule } from './module-auth/auth.module';
import { FileManagementModule } from './module-file-management/file.module';
import { EmailModule } from './module-email/email.module';

@Module({
  imports: [
    AuthModule,
    PersonModule,
    OrganizationModule,
    DepartmentModule,
    TeamModule,
    ObjectiveModule,
    KeyResultModule,
    InitiativeModule,
    AlignmentModule,
    TrackingModule,
    InterventionModule,
    LabelModule,
    TaskModule,
    FileManagementModule,
    EmailModule,
  ],
})
export class MainModule {}
