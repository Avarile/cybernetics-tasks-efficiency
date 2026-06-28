import { HttpStatus } from '@nestjs/common';
import { AppException, BusinessException, ERROR_CATALOG, ErrorCode } from './exception.provider';

describe('ERROR_CATALOG', () => {
  it('covers all 8 expected codes', () => {
    const codes: ErrorCode[] = [
      'DATABASE_QUERY_FAILED',
      'RESOURCE_NOT_FOUND',
      'RESOURCE_CONFLICT',
      'VALIDATION_FAILED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'SYSTEM_INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ];
    for (const code of codes) {
      expect(ERROR_CATALOG[code]).toBeDefined();
      expect(typeof ERROR_CATALOG[code].status).toBe('number');
      expect(typeof ERROR_CATALOG[code].message).toBe('string');
    }
  });

  it('maps each code to the correct HTTP status', () => {
    expect(ERROR_CATALOG.DATABASE_QUERY_FAILED.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(ERROR_CATALOG.RESOURCE_NOT_FOUND.status).toBe(HttpStatus.NOT_FOUND);
    expect(ERROR_CATALOG.RESOURCE_CONFLICT.status).toBe(HttpStatus.CONFLICT);
    expect(ERROR_CATALOG.VALIDATION_FAILED.status).toBe(HttpStatus.BAD_REQUEST);
    expect(ERROR_CATALOG.UNAUTHORIZED.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(ERROR_CATALOG.FORBIDDEN.status).toBe(HttpStatus.FORBIDDEN);
    expect(ERROR_CATALOG.SYSTEM_INTERNAL_ERROR.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(ERROR_CATALOG.SERVICE_UNAVAILABLE.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

describe('AppException.throw', () => {
  it('throws a BusinessException', () => {
    expect(() => AppException.throw('RESOURCE_NOT_FOUND')).toThrow(BusinessException);
  });

  it('uses the catalog default message when no message given', () => {
    let caught: BusinessException | undefined;
    try { AppException.throw('RESOURCE_NOT_FOUND'); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe(ERROR_CATALOG.RESOURCE_NOT_FOUND.message);
    expect(caught!.code).toBe('RESOURCE_NOT_FOUND');
    expect(caught!.status).toBe(HttpStatus.NOT_FOUND);
  });

  it('uses a custom message when provided', () => {
    let caught: BusinessException | undefined;
    try { AppException.throw('RESOURCE_NOT_FOUND', 'my message'); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe('my message');
  });

  it('accepts metadata as second arg (no custom message)', () => {
    let caught: BusinessException | undefined;
    try { AppException.throw('DATABASE_QUERY_FAILED', { cause: 'connection refused' }); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe(ERROR_CATALOG.DATABASE_QUERY_FAILED.message);
    expect(caught!.metadata).toEqual({ cause: 'connection refused' });
  });

  it('accepts both custom message and metadata', () => {
    let caught: BusinessException | undefined;
    try { AppException.throw('FORBIDDEN', 'not allowed', { resource: 'Objective' }); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe('not allowed');
    expect(caught!.metadata).toEqual({ resource: 'Objective' });
  });

  it('sets no metadata when not provided', () => {
    let caught: BusinessException | undefined;
    try { AppException.throw('UNAUTHORIZED', 'bad token'); } catch (e) { caught = e as BusinessException; }
    expect(caught!.metadata).toBeUndefined();
  });

  it('maps every catalog code to its status', () => {
    for (const [code, def] of Object.entries(ERROR_CATALOG)) {
      let caught: BusinessException | undefined;
      try { AppException.throw(code as ErrorCode); } catch (e) { caught = e as BusinessException; }
      expect(caught!.status).toBe(def.status);
    }
  });
});

describe('AppException.notFound', () => {
  it('throws RESOURCE_NOT_FOUND with entity name alone', () => {
    let caught: BusinessException | undefined;
    try { AppException.notFound('Objective'); } catch (e) { caught = e as BusinessException; }
    expect(caught!.code).toBe('RESOURCE_NOT_FOUND');
    expect(caught!.status).toBe(HttpStatus.NOT_FOUND);
    expect(caught!.message).toBe('Objective not found');
    expect(caught!.metadata).toEqual({ entity: 'Objective', id: undefined });
  });

  it('includes numeric id in message', () => {
    let caught: BusinessException | undefined;
    try { AppException.notFound('Objective', 42); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe('Objective 42 not found');
    expect(caught!.metadata).toEqual({ entity: 'Objective', id: 42 });
  });

  it('includes string slug in message', () => {
    let caught: BusinessException | undefined;
    try { AppException.notFound('Initiative', 'my-slug'); } catch (e) { caught = e as BusinessException; }
    expect(caught!.message).toBe('Initiative my-slug not found');
    expect(caught!.metadata).toEqual({ entity: 'Initiative', id: 'my-slug' });
  });
});

describe('AppException.isBusinessException', () => {
  it('returns true for BusinessException', () => {
    const e = new BusinessException('FORBIDDEN', 'no', 403);
    expect(AppException.isBusinessException(e)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(AppException.isBusinessException(new Error('oops'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(AppException.isBusinessException('string')).toBe(false);
    expect(AppException.isBusinessException(null)).toBe(false);
  });
});
