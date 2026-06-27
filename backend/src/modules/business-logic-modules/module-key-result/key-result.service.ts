import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { KeyResultRepository } from './key-result.repo';
import {
  INewKeyResult,
  IUpdateKeyResult,
  IKeyResultEntity,
  IQueryKeyResultParams,
} from './key-result.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class KeyResultService {
  constructor(private readonly repo: KeyResultRepository) {}

  async create(item: INewKeyResult, ctx: IDBConfigOptions): Promise<IKeyResultEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IKeyResultEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `KeyResult ${id} not found`);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IKeyResultEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `KeyResult '${slug}' not found`);
    return entity!;
  }

  async update(id: number, payload: IUpdateKeyResult, ctx: IDBConfigOptions): Promise<IKeyResultEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IKeyResultEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryKeyResultParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findByObjective(objectiveId: number, ctx: IDBConfigOptions): Promise<IKeyResultEntity[]> {
    return this.repo.findByObjectiveId(objectiveId, ctx);
  }

  async updateCurrentValue(id: number, value: string, ctx: IDBConfigOptions): Promise<IKeyResultEntity> {
    return this.repo.updateCurrentValue(id, value, ctx);
  }
}
