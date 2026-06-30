import { Injectable } from '@nestjs/common';
import { subject } from '@casl/ability';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { FileService } from 'src/modules/module-file-management/file.service';
import { PersonRepository } from '../module-person/person.repo';
import { TaskRepository } from '../module-task/task.repo';
import { KnowledgeRepository } from './knowledge.repo';
import {
  IKnowledgeEntity,
  IQueryKnowledgeParams,
  IUpdateKnowledge,
} from './knowledge.interface';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly personRepo: PersonRepository,
    private readonly taskRepo: TaskRepository,
    private readonly files: FileService,
  ) {}

  async create(
    item: { title: string; body?: string | null; visibility?: 'private' | 'shared' | 'organization' },
    ownerPersonId: number,
    ctx: IDBConfigOptions,
  ): Promise<IKnowledgeEntity> {
    return this.repo.create({ ...item, ownerPersonId }, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Knowledge', id);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Knowledge', slug);
    return entity!;
  }

  /**
   * Authorize a read. Readable if ANY of:
   *  1. CASL row rule allows it (owner / organization / admin),
   *  2. visibility='shared' AND the user is an explicit grantee,
   *  3. the entry is attached to a task the user can read.
   */
  async requireReadable(
    entity: IKnowledgeEntity,
    ctx: IDBConfigOptions,
    ability: AppAbility,
    user: IUserSession,
  ): Promise<IKnowledgeEntity> {
    if (ability.can('read', subject('Knowledge', entity as unknown as Record<string, unknown>))) {
      return entity;
    }

    if (entity.visibility === 'shared') {
      const grantees = await this.repo.findShareePersonIds(entity.id, ctx);
      if (grantees.includes(user.id)) return entity;
    }

    const taskIds = await this.repo.findTaskIds(entity.id, ctx);
    if (taskIds.length) {
      const tasks = await Promise.all(taskIds.map((id) => this.taskRepo.findById(id, ctx)));
      const readable = tasks.some(
        (t) => t && ability.can('read', subject('Task', t as unknown as Record<string, unknown>)),
      );
      if (readable) return entity;
    }

    AppException.throw('FORBIDDEN', 'You cannot view this knowledge');
  }

  async requireReadableById(
    id: number,
    ctx: IDBConfigOptions,
    ability: AppAbility,
    user: IUserSession,
  ): Promise<IKnowledgeEntity> {
    return this.requireReadable(await this.requireById(id, ctx), ctx, ability, user);
  }

  async requireReadableBySlug(
    slug: string,
    ctx: IDBConfigOptions,
    ability: AppAbility,
    user: IUserSession,
  ): Promise<IKnowledgeEntity> {
    return this.requireReadable(await this.requireBySlug(slug, ctx), ctx, ability, user);
  }

  async requireWritable(
    slug: string,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IKnowledgeEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'update', 'Knowledge', entity, 'You cannot modify this knowledge');
    return entity;
  }

  async update(
    slug: string,
    payload: IUpdateKnowledge,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IKnowledgeEntity> {
    const existing = await this.requireWritable(slug, ctx, ability);
    return this.repo.update(existing.id, payload, ctx);
  }

  async remove(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'delete', 'Knowledge', existing, 'You cannot delete this knowledge');
    await this.repo.delete(existing.id, ctx);
  }

  async search(
    params: IQueryKnowledgeParams,
    ctx: IDBConfigOptions,
    user: IUserSession,
  ): Promise<IBaseQueryResult> {
    const unrestricted = user.role === 'admin';
    const sharedIds = unrestricted
      ? []
      : await this.repo.findSharedKnowledgeIdsForPerson(user.id, ctx);
    return this.repo.query({ ...params, requesterId: user.id, sharedIds, unrestricted }, ctx);
  }
}
