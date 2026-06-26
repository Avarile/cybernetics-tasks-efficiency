import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { person } from 'src/infra/application-db/schema/identity.schema';
import { ICreatePersonDTO, IPersonRecord } from './auth.interface';

@Injectable()
export class PersonAccountRepository {
  private readonly logger = new Logger(PersonAccountRepository.name);

  constructor(private readonly db: ApplicationDBProvider) {}

  async findByEmail(email: string, ctx: IDBConfigOptions): Promise<IPersonRecord | null> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const rows = await dbConnection.select().from(person).where(eq(person.email, email)).limit(1);
      return (rows[0] as IPersonRecord) ?? null;
    } catch (err) {
      this.logger.error('findByEmail failed', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async createPerson(dto: ICreatePersonDTO, ctx: IDBConfigOptions): Promise<IPersonRecord> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const rows = await dbConnection
        .insert(person)
        .values({
          name: dto.name,
          email: dto.email,
          passwordHash: dto.passwordHash,
          role: dto.role,
        })
        .returning();
      return rows[0] as IPersonRecord;
    } catch (err) {
      this.logger.error('createPerson failed', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: number, ctx: IDBConfigOptions): Promise<IPersonRecord | null> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const rows = await dbConnection.select().from(person).where(eq(person.id, id)).limit(1);
      return (rows[0] as IPersonRecord) ?? null;
    } catch (err) {
      this.logger.error('findById failed', err);
      throw err;
    } finally {
      client.release();
    }
  }
}
