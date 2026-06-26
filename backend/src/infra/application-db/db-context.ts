import { Injectable } from '@nestjs/common';
import env from 'src/utils/env';
import { IDBConfigOptions } from './application-db.module';

@Injectable()
export class DbContextService {
  private readonly uri = `postgresql://${env.DATABASE_MAIN_HOST}:${env.DATABASE_MAIN_PORT}/${env.DATABASE_MAIN_DATABASE}?user=${env.DATABASE_MAIN_USERNAME}&password=${env.DATABASE_MAIN_PASSWORD}`;

  forUser(userId: number): IDBConfigOptions {
    return { database_uri: this.uri, schema_id: env.COMPANY_SCHEMA, user_id: userId };
  }

  system(): IDBConfigOptions {
    return this.forUser(0);
  }
}
