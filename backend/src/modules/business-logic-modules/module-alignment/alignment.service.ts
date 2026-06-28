import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { IAlignmentLinkEntity, INewAlignmentLink } from './alignment.interface';

@Injectable()
export class AlignmentService {
  constructor(
    private readonly alignmentRepo: AlignmentRepository,
    private readonly okrTreeService: OkrTreeService,
    private readonly objectiveRepo: ObjectiveRepository,
  ) {}

  async link(payload: INewAlignmentLink, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity> {
    return this.alignmentRepo.link(payload, ctx);
  }

  async unlink(id: number, ctx: IDBConfigOptions): Promise<void> {
    return this.alignmentRepo.unlink(id, ctx);
  }

  async listByFrom(fromType: string, fromId: number, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity[]> {
    return this.alignmentRepo.findParents(fromType, fromId, ctx);
  }

  async listByTo(toType: string, toId: number, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity[]> {
    return this.alignmentRepo.findChildren(toType, toId, ctx);
  }

  async getTree(objectiveSlug: string, ctx: IDBConfigOptions) {
    const objective = await this.objectiveRepo.findBySlug(objectiveSlug, ctx);
    if (!objective) AppException.notFound('Objective', objectiveSlug);
    return this.okrTreeService.buildTree(objective!.id, ctx);
  }
}
