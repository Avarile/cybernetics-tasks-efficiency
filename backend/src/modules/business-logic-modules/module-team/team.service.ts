import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { TeamRepository } from './team.repo';
import {
  INewTeam,
  IUpdateTeam,
  ITeamEntity,
  IQueryTeamParams,
} from './team.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class TeamService {
  constructor(private readonly repo: TeamRepository) {}

  async create(item: INewTeam, ctx: IDBConfigOptions): Promise<ITeamEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<ITeamEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.throw('RESOURCE_NOT_FOUND', `Team ${id} not found`);
    return entity!;
  }

  async update(id: number, payload: IUpdateTeam, ctx: IDBConfigOptions): Promise<ITeamEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ITeamEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryTeamParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findByDepartmentId(departmentId: number, ctx: IDBConfigOptions): Promise<ITeamEntity[]> {
    return this.repo.findByDepartmentId(departmentId, ctx);
  }
}
