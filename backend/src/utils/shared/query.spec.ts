import { withPagination } from './query';

// Build a minimal fake QueryBuilder that mimics drizzle's chaining interface
function makeQb() {
  const qb: any = {
    _limit: undefined as number | undefined,
    _offset: undefined as number | undefined,
    limit(n: number) {
      this._limit = n;
      return this;
    },
    offset(n: number) {
      this._offset = n;
      return this;
    },
  };
  return qb;
}

describe('withPagination', () => {
  it('sets limit and offset for page 1 with explicit pageSize', () => {
    const qb = makeQb();
    withPagination(qb as any, 1, 10);
    expect(qb._limit).toBe(10);
    expect(qb._offset).toBe(0);
  });

  it('sets correct offset for page 2', () => {
    const qb = makeQb();
    withPagination(qb as any, 2, 10);
    expect(qb._limit).toBe(10);
    expect(qb._offset).toBe(10);
  });

  it('defaults to page 1 when page is undefined', () => {
    const qb = makeQb();
    withPagination(qb as any, undefined, 25);
    expect(qb._offset).toBe(0);
    expect(qb._limit).toBe(25);
  });

  it('defaults pageSize to 50 when not provided', () => {
    const qb = makeQb();
    withPagination(qb as any, 1, undefined);
    expect(qb._limit).toBe(50);
    expect(qb._offset).toBe(0);
  });

  it('defaults both page and pageSize when neither provided', () => {
    const qb = makeQb();
    withPagination(qb as any);
    expect(qb._limit).toBe(50);
    expect(qb._offset).toBe(0);
  });

  it('computes offset correctly for page 3, pageSize 20', () => {
    const qb = makeQb();
    withPagination(qb as any, 3, 20);
    expect(qb._limit).toBe(20);
    expect(qb._offset).toBe(40);
  });
});
