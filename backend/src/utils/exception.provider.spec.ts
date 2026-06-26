import { AppException, BusinessException } from './exception.provider';

describe('AppException', () => {
  it('throws a BusinessException with code + message', () => {
    expect(() => AppException.throw('RESOURCE_NOT_FOUND', 'x not found')).toThrow(
      BusinessException,
    );
    let caught: BusinessException | undefined;
    try {
      AppException.throw('RESOURCE_NOT_FOUND', 'x');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.code).toBe('RESOURCE_NOT_FOUND');
    expect(caught!.status).toBe(404);
  });

  it('maps DATABASE_QUERY_FAILED to 500', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('DATABASE_QUERY_FAILED', 'db error');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(500);
  });

  it('maps RESOURCE_CONFLICT to 409', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('RESOURCE_CONFLICT', 'conflict');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(409);
  });

  it('maps VALIDATION_FAILED to 400', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('VALIDATION_FAILED', 'bad input');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(400);
  });

  it('maps UNAUTHORIZED to 401', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('UNAUTHORIZED', 'no auth');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(401);
  });

  it('maps FORBIDDEN to 403', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('FORBIDDEN', 'no access');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(403);
  });

  it('maps SYSTEM_INTERNAL_ERROR to 500', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('SYSTEM_INTERNAL_ERROR', 'internal');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(500);
  });

  it('defaults to 500 for unknown codes', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('UNKNOWN_CODE', 'something');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.status).toBe(500);
  });

  it('preserves the message in the exception', () => {
    let caught: BusinessException | undefined;
    try {
      AppException.throw('RESOURCE_NOT_FOUND', 'my message');
    } catch (e) {
      caught = e as BusinessException;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect(caught!.message).toBe('my message');
  });
});
