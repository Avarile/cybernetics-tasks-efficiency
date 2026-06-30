import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonRepository } from './person.repo';
import { PersonService } from './person.service';
import { AuthModule } from 'src/modules/module-auth/auth.module';
import { FileManagementModule } from 'src/modules/module-file-management/file.module';

@Module({
  imports: [AuthModule, FileManagementModule],
  controllers: [PersonController],
  providers: [PersonRepository, PersonService],
  exports: [PersonRepository, PersonService],
})
export class PersonModule {}
