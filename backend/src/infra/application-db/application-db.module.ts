import { Global, Module } from '@nestjs/common';
import ApplicationDBProvider from './db-connection';
import { DbContextService } from './db-context';

export interface IDBConfigOptions {
  database_uri: string;
  schema_id: string;
  user_id: number;
}

@Global()
@Module({
  providers: [ApplicationDBProvider, DbContextService],
  exports: [ApplicationDBProvider, DbContextService],
})
export class ApplicationDbModule {}
