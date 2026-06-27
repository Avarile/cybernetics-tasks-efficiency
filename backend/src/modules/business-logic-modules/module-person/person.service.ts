import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { PersonRepository } from './person.repo';
import {
  INewPerson,
  IUpdatePerson,
  IPersonEntity,
  IQueryPersonParams,
} from './person.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class PersonService {
  constructor(private readonly repo: PersonRepository) {}

  async create(item: INewPerson, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Person ${id} not found`);
    return entity!;
  }

  async update(id: number, payload: IUpdatePerson, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IPersonEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryPersonParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findByName(name: string, ctx: IDBConfigOptions): Promise<IPersonEntity | null> {
    return this.repo.findByName(name, ctx);
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IPersonEntity | null> {
    return this.repo.findBySlug(slug, ctx);
  }
}
