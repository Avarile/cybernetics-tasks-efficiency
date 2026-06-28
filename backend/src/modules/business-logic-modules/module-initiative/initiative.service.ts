import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { InitiativeRepository } from './initiative.repo';
import {
  INewInitiative,
  IUpdateInitiative,
  IInitiativeEntity,
  IQueryInitiativeParams,
} from './initiative.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class InitiativeService {
  constructor(private readonly repo: InitiativeRepository) {}

  async create(item: INewInitiative, ctx: IDBConfigOptions): Promise<IInitiativeEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IInitiativeEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Initiative ${id} not found`);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IInitiativeEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Initiative '${slug}' not found`);
    return entity!;
  }

  /** requireById + row-level read authorization. */
  async requireByIdAuthorized(
    id: number,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IInitiativeEntity> {
    const entity = await this.requireById(id, ctx);
    assertAbility(ability, 'read', 'Initiative', entity, 'You cannot view this initiative');
    return entity;
  }

  /** requireBySlug + row-level read authorization. */
  async requireBySlugAuthorized(
    slug: string,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IInitiativeEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'read', 'Initiative', entity, 'You cannot view this initiative');
    return entity;
  }

  async update(
    id: number,
    payload: IUpdateInitiative,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IInitiativeEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Initiative', existing, 'You cannot update this initiative');
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'delete', 'Initiative', existing, 'You cannot delete this initiative');
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IInitiativeEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryInitiativeParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findById(id: number, ctx: IDBConfigOptions): Promise<IInitiativeEntity | null> {
    return this.repo.findById(id, ctx);
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IInitiativeEntity | null> {
    return this.repo.findBySlug(slug, ctx);
  }

  async findByOwner(ownerPersonId: number, ctx: IDBConfigOptions): Promise<IInitiativeEntity[]> {
    return this.repo.findByOwner(ownerPersonId, ctx);
  }

  async linkKeyResult(initiativeId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.linkKeyResult(initiativeId, keyResultId, ctx);
  }

  async unlinkKeyResult(initiativeId: number, keyResultId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.unlinkKeyResult(initiativeId, keyResultId, ctx);
  }

  async findKeyResultIds(initiativeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findKeyResultIds(initiativeId, ctx);
  }
}
