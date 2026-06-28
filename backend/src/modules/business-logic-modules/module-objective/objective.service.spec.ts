import { ObjectiveService } from './objective.service';

const makeCtx = () => ({
  database_uri: 'postgresql://test',
  schema_id: 'test',
  user_id: 1,
});

// Minimal CASL ability stubs: assertAbility() consults `cannot`.
const allow = { can: () => true, cannot: () => false } as any;
const deny = { can: () => false, cannot: () => true } as any;

describe('ObjectiveService', () => {
  let findById: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let deleteFn: jest.Mock;
  let svc: ObjectiveService;

  beforeEach(() => {
    findById = jest.fn();
    create = jest.fn();
    update = jest.fn();
    deleteFn = jest.fn();

    svc = new ObjectiveService({
      findById,
      create,
      update,
      delete: deleteFn,
    } as any);
  });

  it('create() delegates to repo.create', async () => {
    const item = { title: 'O1' } as any;
    create.mockResolvedValue({ id: 1, title: 'O1' });
    const result = await svc.create(item, makeCtx());
    expect(create).toHaveBeenCalledWith(item, makeCtx());
    expect(result).toEqual({ id: 1, title: 'O1' });
  });

  it('requireById() throws RESOURCE_NOT_FOUND when not found', async () => {
    findById.mockResolvedValue(null);
    await expect(svc.requireById(99, makeCtx())).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('requireById() returns entity when found', async () => {
    findById.mockResolvedValue({ id: 5 });
    const result = await svc.requireById(5, makeCtx());
    expect(result).toEqual({ id: 5 });
  });

  it('remove() throws when not found', async () => {
    findById.mockResolvedValue(null);
    await expect(svc.remove(99, makeCtx(), allow)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('remove() calls repo.delete when found and authorized', async () => {
    findById.mockResolvedValue({ id: 5 });
    deleteFn.mockResolvedValue(undefined);
    await svc.remove(5, makeCtx(), allow);
    expect(deleteFn).toHaveBeenCalledWith(5, makeCtx());
  });

  it('remove() throws FORBIDDEN and does not delete when ability denies', async () => {
    findById.mockResolvedValue({ id: 5, ownerPersonId: 999 });
    await expect(svc.remove(5, makeCtx(), deny)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('update() throws FORBIDDEN and does not update when ability denies', async () => {
    findById.mockResolvedValue({ id: 5, ownerPersonId: 999 });
    await expect(svc.update(5, { title: 'x' } as any, makeCtx(), deny)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('update() delegates to repo.update when authorized', async () => {
    findById.mockResolvedValue({ id: 5 });
    update.mockResolvedValue({ id: 5, title: 'x' });
    const result = await svc.update(5, { title: 'x' } as any, makeCtx(), allow);
    expect(update).toHaveBeenCalledWith(5, { title: 'x' }, makeCtx());
    expect(result).toEqual({ id: 5, title: 'x' });
  });
});
