import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { ObjectiveRepository } from './objective.repo';
import {
  INewObjective,
  IUpdateObjective,
  IObjectiveEntity,
  IQueryObjectiveParams,
} from './objective.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class ObjectiveService {
  constructor(private readonly repo: ObjectiveRepository) {}

  async create(item: INewObjective, ctx: IDBConfigOptions): Promise<IObjectiveEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IObjectiveEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Objective', id);
    return entity!;
  }

  async update(
    id: number,
    payload: IUpdateObjective,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IObjectiveEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Objective', existing, 'You cannot update this objective');
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'delete', 'Objective', existing, 'You cannot delete this objective');
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IObjectiveEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryObjectiveParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findById(id: number, ctx: IDBConfigOptions): Promise<IObjectiveEntity | null> {
    return this.repo.findById(id, ctx);
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IObjectiveEntity | null> {
    return this.repo.findBySlug(slug, ctx);
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IObjectiveEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Objective', slug);
    return entity!;
  }

  async findByOwner(ownerPersonId: number, ctx: IDBConfigOptions): Promise<IObjectiveEntity[]> {
    return this.repo.findByOwner(ownerPersonId, ctx);
  }

  async findByScope(
    scope: 'org' | 'department' | 'team',
    scopeRefId: number | null | undefined,
    ctx: IDBConfigOptions,
  ): Promise<IObjectiveEntity[]> {
    return this.repo.findByScope(scope, scopeRefId, ctx);
  }
}
