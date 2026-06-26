import { Module } from '@nestjs/common';
import { AuthModule } from './module-auth/auth.module';
import { PersonModule } from './business-logic-modules/module-person/person.module';
import { OrganizationModule } from './business-logic-modules/module-organization/organization.module';

@Module({ imports: [AuthModule, PersonModule, OrganizationModule] })
export class MainModule {}
