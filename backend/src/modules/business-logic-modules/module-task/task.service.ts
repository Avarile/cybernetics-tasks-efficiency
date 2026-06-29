import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { TaskRepository } from './task.repo';
import { InitiativeRepository } from '../module-initiative/initiative.repo';
import { PersonRepository } from '../module-person/person.repo';
import { LabelRepository } from '../module-label/label.repo';
import { INewTask, IUpdateTask, ITaskEntity, IQueryTaskParams, ITaskSummary } from './task.interface';

@Injectable()
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly initiativeRepo: InitiativeRepository,
    private readonly personRepo: PersonRepository,
    private readonly labelRepo: LabelRepository,
  ) {}

  async create(item: INewTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    const initiative = await this.initiativeRepo.findById(item.initiativeId, ctx);
    if (!initiative) AppException.notFound('Initiative', item.initiativeId);

    if (item.parentId != null) {
      if (item.parentId === item.initiativeId) {
        AppException.throw('VALIDATION_FAILED', 'A task cannot be its own parent');
      }
      const parent = await this.repo.findById(item.parentId, ctx);
      if (!parent) AppException.notFound('Task', item.parentId);
    }

    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Task', id);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Task', slug);
    return entity!;
  }

  async requireByIdAuthorized(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const entity = await this.requireById(id, ctx);
    assertAbility(ability, 'read', 'Task', entity, 'You cannot view this task');
    return entity;
  }

  async requireBySlugAuthorized(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'read', 'Task', entity, 'You cannot view this task');
    return entity;
  }

  async requireBySlugForWrite(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'update', 'Task', entity, 'You cannot modify this task');
    return entity;
  }

  async update(id: number, payload: IUpdateTask, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Task', existing, 'You cannot update this task');
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'delete', 'Task', existing, 'You cannot delete this task');
    await this.repo.delete(id, ctx);
  }

  async search(params: IQueryTaskParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async summary(initiativeId: number, ctx: IDBConfigOptions): Promise<ITaskSummary> {
    return this.repo.countByInitiative(initiativeId, ctx);
  }

  async assign(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    const person = await this.personRepo.findById(personId, ctx);
    if (!person) AppException.notFound('Person', personId);
    return this.repo.linkAssignee(taskId, personId, ctx);
  }

  async unassign(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.unlinkAssignee(taskId, personId, ctx);
  }

  async listAssignees(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findAssigneeIds(taskId, ctx);
  }

  async addLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    const lbl = await this.labelRepo.findById(labelId, ctx);
    if (!lbl) AppException.notFound('Label', labelId);
    return this.repo.addLabel(taskId, labelId, ctx);
  }

  async removeLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.removeLabel(taskId, labelId, ctx);
  }

  async listLabels(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findLabelIds(taskId, ctx);
  }
}
