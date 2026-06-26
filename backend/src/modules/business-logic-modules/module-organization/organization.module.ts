import { Module } from '@nestjs/common';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repo';

@Module({
  imports: [ApplicationDbModule, AuthModule],
  controllers: [OrganizationController],
  providers: [OrganizationRepository],
  exports: [OrganizationRepository],
})
export class OrganizationModule {}
