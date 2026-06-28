import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { OrganizationRepository } from './organization.repo';
import {
  INewOrganization,
  IUpdateOrganization,
  IOrganizationEntity,
  IQueryOrganizationParams,
} from './organization.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class OrganizationService {
  constructor(private readonly repo: OrganizationRepository) {}

  async create(item: INewOrganization, ctx: IDBConfigOptions): Promise<IOrganizationEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IOrganizationEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Organization', id);
    return entity!;
  }

  async update(id: number, payload: IUpdateOrganization, ctx: IDBConfigOptions): Promise<IOrganizationEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IOrganizationEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryOrganizationParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findByName(name: string, ctx: IDBConfigOptions): Promise<IOrganizationEntity | null> {
    return this.repo.findByName(name, ctx);
  }

  async requireByName(name: string, ctx: IDBConfigOptions): Promise<IOrganizationEntity> {
    const entity = await this.repo.findByName(name, ctx);
    if (!entity) AppException.notFound('Organization', name);
    return entity!;
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IOrganizationEntity | null> {
    return this.repo.findBySlug(slug, ctx);
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IOrganizationEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Organization', slug);
    return entity!;
  }
}
