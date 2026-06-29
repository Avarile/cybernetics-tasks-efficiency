import { AlignmentService } from './alignment.service';
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import { BusinessException } from '../../../utils/exception.provider';
import { IDBConfigOptions } from '../../../infra/application-db/application-db.module';
import { INewAlignmentLink } from './alignment.interface';

describe('AlignmentService.link guards', () => {
  const ctx = {} as IDBConfigOptions;

  let alignmentRepo: jest.Mocked<Pick<AlignmentRepository, 'link' | 'findParents'>>;
  let objectiveRepo: jest.Mocked<Pick<ObjectiveRepository, 'findById'>>;
  let keyResultRepo: jest.Mocked<Pick<KeyResultRepository, 'findById'>>;
  let service: AlignmentService;

  const basePayload: INewAlignmentLink = {
    fromType: 'objective',
    fromId: 1,
    toType: 'objective',
    toId: 2,
  };

  beforeEach(() => {
    alignmentRepo = {
      link: jest.fn().mockResolvedValue({ id: 99 }),
      findParents: jest.fn().mockResolvedValue([]),
    };
    objectiveRepo = {
      findById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    keyResultRepo = {
      findById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    service = new AlignmentService(
      alignmentRepo as unknown as AlignmentRepository,
      {} as OkrTreeService,
      objectiveRepo as unknown as ObjectiveRepository,
      keyResultRepo as unknown as KeyResultRepository,
    );
  });

  it('creates the link when both endpoints exist and no duplicate', async () => {
    const result = await service.link(basePayload, ctx);
    expect(alignmentRepo.link).toHaveBeenCalledWith(basePayload, ctx);
    expect(result).toEqual({ id: 99 });
  });

  it('rejects a self-link', async () => {
    await expect(
      service.link({ fromType: 'objective', fromId: 5, toType: 'objective', toId: 5 }, ctx),
    ).rejects.toBeInstanceOf(BusinessException);
    expect(alignmentRepo.link).not.toHaveBeenCalled();
  });

  it('rejects when the from endpoint does not exist', async () => {
    objectiveRepo.findById.mockResolvedValueOnce(null);
    await expect(service.link(basePayload, ctx)).rejects.toBeInstanceOf(BusinessException);
    expect(alignmentRepo.link).not.toHaveBeenCalled();
  });

  it('rejects when the to endpoint does not exist', async () => {
    objectiveRepo.findById
      .mockResolvedValueOnce({ id: 1 } as any) // from
      .mockResolvedValueOnce(null); // to
    await expect(service.link(basePayload, ctx)).rejects.toBeInstanceOf(BusinessException);
    expect(alignmentRepo.link).not.toHaveBeenCalled();
  });

  it('resolves a key_result endpoint via the key-result repo', async () => {
    await service.link(
      { fromType: 'key_result', fromId: 3, toType: 'objective', toId: 2 },
      ctx,
    );
    expect(keyResultRepo.findById).toHaveBeenCalledWith(3, ctx);
    expect(objectiveRepo.findById).toHaveBeenCalledWith(2, ctx);
  });

  it('rejects a duplicate live edge', async () => {
    alignmentRepo.findParents.mockResolvedValueOnce([
      { toType: 'objective', toId: 2 } as any,
    ]);
    await expect(service.link(basePayload, ctx)).rejects.toBeInstanceOf(BusinessException);
    expect(alignmentRepo.link).not.toHaveBeenCalled();
  });
});
