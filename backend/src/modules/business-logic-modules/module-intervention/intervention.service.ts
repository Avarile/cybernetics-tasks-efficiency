import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { InterventionRepository } from './intervention.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import {
  INewIntervention,
  IUpdateIntervention,
  IInterventionEntity,
  IQueryInterventionParams,
} from './intervention.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class InterventionService {
  constructor(
    private readonly repo: InterventionRepository,
    private readonly keyResultRepo: KeyResultRepository,
  ) {}

  async create(item: INewIntervention, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Intervention', id);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IInterventionEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Intervention', slug);
    return entity!;
  }

  async update(
    id: number,
    payload: IUpdateIntervention,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IInterventionEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Intervention', existing, 'You cannot update this intervention');
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'delete', 'Intervention', existing, 'You cannot delete this intervention');
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IInterventionEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryInterventionParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async linkKeyResult(interventionId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(interventionId, ctx);
    const kr = await this.keyResultRepo.findById(keyResultId, ctx);
    if (!kr) AppException.notFound('KeyResult', keyResultId);
    return this.repo.linkKeyResult(interventionId, keyResultId, ctx);
  }

  async unlinkKeyResult(interventionId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.unlinkKeyResult(interventionId, keyResultId, ctx);
  }

  async findAffectedKeyResultIds(interventionId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findAffectedKeyResultIds(interventionId, ctx);
  }
}
