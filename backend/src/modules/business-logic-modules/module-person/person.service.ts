import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { FileService } from 'src/modules/module-file-management/file.service';
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
  constructor(
    private readonly repo: PersonRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly files: FileService,
  ) {}

  /**
   * Bust the per-account cache populated by JwtStrategy (keyed by schema + id),
   * so a role/active/deleted change takes effect before the TTL expires.
   */
  private async invalidateAccount(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.cache.del(cacheKey.account(ctx.schema_id, id));
  }

  async create(item: INewPerson, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Person', id);
    return entity!;
  }

  async update(
    id: number,
    payload: IUpdatePerson,
    ctx: IDBConfigOptions,
    ability: AppAbility,
  ): Promise<IPersonEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Person', existing, 'You cannot update this person');
    const updated = await this.repo.update(id, payload, ctx);
    await this.invalidateAccount(id, ctx);
    return updated;
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
    await this.invalidateAccount(id, ctx);
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

  async requireByName(name: string, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    const entity = await this.repo.findByName(name, ctx);
    if (!entity) AppException.notFound('Person', name);
    return entity!;
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IPersonEntity | null> {
    return this.repo.findBySlug(slug, ctx);
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IPersonEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Person', slug);
    return entity!;
  }

  async attachAvatarUrl<T extends { avatarAttachmentId?: number | null }>(
    entity: T,
    ctx: IDBConfigOptions,
  ): Promise<T & { avatarUrl: string | null }> {
    if (!entity.avatarAttachmentId) return { ...entity, avatarUrl: null };
    const [resolved] = await this.files.getLinkByIds([entity.avatarAttachmentId], ctx);
    return { ...entity, avatarUrl: resolved?.url ?? null };
  }
}
