import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { DepartmentRepository } from './department.repo';
import {
  INewDepartment,
  IUpdateDepartment,
  IDepartmentEntity,
  IQueryDepartmentParams,
} from './department.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';

@Injectable()
export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  async create(item: INewDepartment, ctx: IDBConfigOptions): Promise<IDepartmentEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IDepartmentEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Department', id);
    return entity!;
  }

  async update(id: number, payload: IUpdateDepartment, ctx: IDBConfigOptions): Promise<IDepartmentEntity> {
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<IDepartmentEntity[]> {
    return this.repo.queryAll(ctx);
  }

  async search(params: IQueryDepartmentParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async findRoots(ctx: IDBConfigOptions): Promise<IDepartmentEntity[]> {
    return this.repo.findRoots(ctx);
  }

  async findByParentId(parentId: number, ctx: IDBConfigOptions): Promise<IDepartmentEntity[]> {
    return this.repo.findByParentId(parentId, ctx);
  }
}
