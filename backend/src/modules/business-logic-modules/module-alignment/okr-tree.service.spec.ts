import { OkrTreeService, KrProgress, OkrTreeNode } from './okr-tree.service';
import { IKeyResultEntity } from '../module-key-result/key-result.interface';
import { IObjectiveEntity } from '../module-objective/objective.interface';
import { IAlignmentLinkEntity } from './alignment.interface';

// ---------------------------------------------------------------------------
// Helpers to build minimal fixtures
// ---------------------------------------------------------------------------

function makeKr(overrides: Partial<IKeyResultEntity> = {}): IKeyResultEntity {
  return {
    id: 1,
    slug: 'kr-1',
    objectiveId: 1,
    title: 'Test KR',
    metricType: 'number',
    direction: 'increase',
    startValue: '0',
    targetValue: '100',
    currentValue: '0',
    unit: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    deletedAt: null,
    isDeleted: false,
    isActive: true,
    ...overrides,
  };
}

function makeObjective(id: number): IObjectiveEntity {
  return {
    id,
    slug: `obj-${id}`,
    title: `Objective ${id}`,
    description: null,
    ownerPersonId: 1,
    scope: 'org',
    scopeRefId: null,
    period: '2024-Q1',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    deletedAt: null,
    isDeleted: false,
    isActive: true,
  };
}

function makeLink(fromId: number, toId: number, id = 100): IAlignmentLinkEntity {
  return {
    id,
    slug: `link-${id}`,
    fromType: 'objective',
    fromId,
    toType: 'objective',
    toId,
    weight: '1.00',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    deletedAt: null,
    isDeleted: false,
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Mock repos
// ---------------------------------------------------------------------------

function buildMocks({
  objectives = new Map<number, IObjectiveEntity>(),
  krsByObjective = new Map<number, IKeyResultEntity[]>(),
  childLinks = new Map<string, IAlignmentLinkEntity[]>(),
} = {}) {
  const objectiveRepo = {
    findById: jest.fn(async (id: number) => objectives.get(id) ?? null),
  } as any;

  const keyResultRepo = {
    findByObjectiveId: jest.fn(async (id: number) => krsByObjective.get(id) ?? []),
  } as any;

  const alignmentRepo = {
    findChildren: jest.fn(async (toType: string, toId: number) => {
      return childLinks.get(`${toType}:${toId}`) ?? [];
    }),
  } as any;

  return { objectiveRepo, keyResultRepo, alignmentRepo };
}

const ctx = { database_uri: 'test', schema_id: 'test', user_id: 1 };

// ---------------------------------------------------------------------------
// Tests: computeKrProgress
// ---------------------------------------------------------------------------

describe('OkrTreeService.computeKrProgress', () => {
  let svc: OkrTreeService;

  beforeEach(() => {
    const { objectiveRepo, keyResultRepo, alignmentRepo } = buildMocks();
    svc = new OkrTreeService(objectiveRepo, keyResultRepo, alignmentRepo);
  });

  it('computes increase direction: start=0, target=100, current=40 → 0.4', () => {
    const kr = makeKr({ startValue: '0', targetValue: '100', currentValue: '40', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBeCloseTo(0.4);
    expect(p.paceStatus).toBe('on_track');
  });

  it('computes decrease direction: start=100, target=0, current=60 → 0.4', () => {
    const kr = makeKr({ startValue: '100', targetValue: '0', currentValue: '60', direction: 'decrease' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBeCloseTo(0.4);
    expect(p.paceStatus).toBe('on_track');
  });

  it('clamps progressPct to [0,1]: current beyond target', () => {
    const kr = makeKr({ startValue: '0', targetValue: '100', currentValue: '150', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBe(1);
    expect(p.paceStatus).toBe('ahead');
  });

  it('returns 0 when current is below start (negative progress clamped)', () => {
    const kr = makeKr({ startValue: '50', targetValue: '100', currentValue: '10', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBe(0);
    expect(p.paceStatus).toBe('behind');
  });

  it('divide-by-zero: start === target for increase, current >= target → 1', () => {
    const kr = makeKr({ startValue: '50', targetValue: '50', currentValue: '50', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBe(1);
  });

  it('divide-by-zero: start === target for increase, current < target → 0', () => {
    const kr = makeKr({ startValue: '50', targetValue: '50', currentValue: '30', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.progressPct).toBe(0);
  });

  it('paceStatus ahead: progressPct >= 0.7', () => {
    const kr = makeKr({ startValue: '0', targetValue: '100', currentValue: '80', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.paceStatus).toBe('ahead');
  });

  it('paceStatus behind: progressPct < 0.4', () => {
    const kr = makeKr({ startValue: '0', targetValue: '100', currentValue: '20', direction: 'increase' });
    const p = svc.computeKrProgress(kr);
    expect(p.paceStatus).toBe('behind');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildTree
// ---------------------------------------------------------------------------

describe('OkrTreeService.buildTree', () => {
  it('builds a nested tree: root with 2 KRs and 1 aligned child objective', async () => {
    const rootObj = makeObjective(1);
    const childObj = makeObjective(2);

    const kr1 = makeKr({ id: 10, objectiveId: 1 });
    const kr2 = makeKr({ id: 11, objectiveId: 1 });

    // child objective (id=2) points UP to parent (id=1) via alignment link
    const link = makeLink(2, 1, 100);

    const { objectiveRepo, keyResultRepo, alignmentRepo } = buildMocks({
      objectives: new Map([[1, rootObj], [2, childObj]]),
      krsByObjective: new Map([[1, [kr1, kr2]], [2, []]]),
      childLinks: new Map([['objective:1', [link]]]),
    });

    const svc = new OkrTreeService(objectiveRepo, keyResultRepo, alignmentRepo);
    const tree = await svc.buildTree(1, ctx);

    expect(tree.objective.id).toBe(1);
    expect(tree.keyResults).toHaveLength(2);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].objective.id).toBe(2);
  });

  it('handles a leaf objective (no children, no KRs)', async () => {
    const obj = makeObjective(5);
    const { objectiveRepo, keyResultRepo, alignmentRepo } = buildMocks({
      objectives: new Map([[5, obj]]),
    });
    const svc = new OkrTreeService(objectiveRepo, keyResultRepo, alignmentRepo);
    const tree = await svc.buildTree(5, ctx);
    expect(tree.children).toHaveLength(0);
    expect(tree.keyResults).toHaveLength(0);
  });

  it('does NOT infinite-loop when A aligns to B and B aligns to A (cycle guard)', async () => {
    const objA = makeObjective(10);
    const objB = makeObjective(11);

    // A (fromId=10) → B (toId=11): B is the parent of A
    // B (fromId=11) → A (toId=10): A is the parent of B  (cycle)
    const linkAtoB = makeLink(10, 11, 200); // child A points to parent B
    const linkBtoA = makeLink(11, 10, 201); // child B points to parent A

    const { objectiveRepo, keyResultRepo, alignmentRepo } = buildMocks({
      objectives: new Map([[10, objA], [11, objB]]),
      krsByObjective: new Map([[10, []], [11, []]]),
      childLinks: new Map([
        ['objective:11', [linkAtoB]],  // when looking for children of B (toId=11) → find A
        ['objective:10', [linkBtoA]],  // when looking for children of A (toId=10) → find B
      ]),
    });

    const svc = new OkrTreeService(objectiveRepo, keyResultRepo, alignmentRepo);

    // Should complete without hanging — cycle guard should break the loop
    const tree = await svc.buildTree(10, ctx);
    expect(tree).toBeDefined();
    // A (10) has one child B (11) via alignment link
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].objective.id).toBe(11);
    // B (11) would recurse back to A (10), but A is already visited.
    // The cycle guard returns A as a leaf (empty KRs, empty children).
    // So B has 1 child (A as cycle-leaf) rather than infinite recursion.
    // This verifies no infinite loop: the recursion terminates.
    const bChildren = tree.children[0].children;
    // Either 0 children (if guard skips adding) or 1 leaf child (A) — both are finite.
    // What matters is the call terminates; let's verify the depth is at most 1 more level.
    expect(bChildren.length).toBeLessThanOrEqual(1);
  });
});
