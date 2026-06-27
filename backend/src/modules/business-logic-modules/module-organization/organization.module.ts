import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repo';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationRepository, OrganizationService],
})
export class OrganizationModule {}
