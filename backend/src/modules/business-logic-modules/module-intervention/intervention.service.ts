import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { InterventionRepository } from './intervention.repo';
import {
  INewIntervention,
  IUpdateIntervention,
  IInterventionEntity,
  IQueryInterventionParams,
} from './intervention.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class InterventionService {
  constructor(private readonly repo: InterventionRepository) {}

  async create(item: INewIntervention, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Intervention ${id} not found`);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Intervention '${slug}' not found`);
    return entity!;
  }

  async update(id: number, payload: IUpdateIntervention, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IInterventionEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryInterventionParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async linkKeyResult(interventionId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.linkKeyResult(interventionId, keyResultId, ctx);
  }

  async unlinkKeyResult(interventionId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.unlinkKeyResult(interventionId, keyResultId, ctx);
  }

  async findAffectedKeyResultIds(interventionId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findAffectedKeyResultIds(interventionId, ctx);
  }
}
