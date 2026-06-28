import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { LabelRepository } from './label.repo';
import { INewLabel, IUpdateLabel, ILabelEntity } from './label.interface';

@Injectable()
export class LabelService {
  constructor(private readonly repo: LabelRepository) {}

  async create(item: INewLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Label', id);
    return entity!;
  }

  async update(id: number, payload: IUpdateLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    await this.requireById(id, ctx);
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    return this.repo.queryAll(ctx);
  }
}
