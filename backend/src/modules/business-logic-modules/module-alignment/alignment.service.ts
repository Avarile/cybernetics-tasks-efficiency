import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import { IAlignmentLinkEntity, INewAlignmentLink } from './alignment.interface';
import { AlignableType } from './alignment.constants';

@Injectable()
export class AlignmentService {
  constructor(
    private readonly alignmentRepo: AlignmentRepository,
    private readonly okrTreeService: OkrTreeService,
    private readonly objectiveRepo: ObjectiveRepository,
    private readonly keyResultRepo: KeyResultRepository,
  ) {}

  async link(payload: INewAlignmentLink, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity> {
    // A self-loop is never a valid alignment edge.
    if (payload.fromType === payload.toType && payload.fromId === payload.toId) {
      AppException.throw('VALIDATION_FAILED', 'An alignment link cannot point to itself');
    }

    // Both endpoints must reference a live row of the declared type.
    await this.assertEndpointExists(payload.fromType, payload.fromId, ctx);
    await this.assertEndpointExists(payload.toType, payload.toId, ctx);

    // No duplicate live edge between the same two endpoints.
    const existing = await this.alignmentRepo.findParents(
      payload.fromType,
      payload.fromId,
      ctx,
    );
    const duplicate = existing.some(
      (e) => e.toType === payload.toType && e.toId === payload.toId,
    );
    if (duplicate) {
      AppException.throw('RESOURCE_CONFLICT', 'This alignment link already exists');
    }

    return this.alignmentRepo.link(payload, ctx);
  }

  /** Ensure the endpoint references a live row of the declared type. */
  private async assertEndpointExists(
    type: AlignableType,
    id: number,
    ctx: IDBConfigOptions,
  ): Promise<void> {
    const found =
      type === 'objective'
        ? await this.objectiveRepo.findById(id, ctx)
        : await this.keyResultRepo.findById(id, ctx);
    if (!found) {
      AppException.notFound(type === 'objective' ? 'Objective' : 'KeyResult', id);
    }
  }

  async unlink(id: number, ctx: IDBConfigOptions): Promise<void> {
    return this.alignmentRepo.unlink(id, ctx);
  }

  async listByFrom(fromType: AlignableType, fromId: number, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity[]> {
    return this.alignmentRepo.findParents(fromType, fromId, ctx);
  }

  async listByTo(toType: AlignableType, toId: number, ctx: IDBConfigOptions): Promise<IAlignmentLinkEntity[]> {
    return this.alignmentRepo.findChildren(toType, toId, ctx);
  }

  async getTree(objectiveSlug: string, ctx: IDBConfigOptions) {
    const objective = await this.objectiveRepo.findBySlug(objectiveSlug, ctx);
    if (!objective) AppException.notFound('Objective', objectiveSlug);
    return this.okrTreeService.buildTree(objective!.id, ctx);
  }
}
