import { AppException, BusinessException } from './exception.provider';

describe('AppException', () => {
  it('throws a BusinessException with code + message', () => {
    expect(() => AppException.throw('RESOURCE_NOT_FOUND', 'x not found')).toThrow(
      BusinessException,
    );
    try {
      AppException.throw('RESOURCE_NOT_FOUND', 'x');
    } catch (e) {
      expect((e as BusinessException).code).toBe('RESOURCE_NOT_FOUND');
      expect((e as BusinessException).status).toBe(404);
    }
  });

  it('maps DATABASE_QUERY_FAILED to 500', () => {
    try {
      AppException.throw('DATABASE_QUERY_FAILED', 'db error');
    } catch (e) {
      expect((e as BusinessException).status).toBe(500);
    }
  });

  it('maps RESOURCE_CONFLICT to 409', () => {
    try {
      AppException.throw('RESOURCE_CONFLICT', 'conflict');
    } catch (e) {
      expect((e as BusinessException).status).toBe(409);
    }
  });

  it('maps VALIDATION_FAILED to 400', () => {
    try {
      AppException.throw('VALIDATION_FAILED', 'bad input');
    } catch (e) {
      expect((e as BusinessException).status).toBe(400);
    }
  });

  it('maps UNAUTHORIZED to 401', () => {
    try {
      AppException.throw('UNAUTHORIZED', 'no auth');
    } catch (e) {
      expect((e as BusinessException).status).toBe(401);
    }
  });

  it('maps FORBIDDEN to 403', () => {
    try {
      AppException.throw('FORBIDDEN', 'no access');
    } catch (e) {
      expect((e as BusinessException).status).toBe(403);
    }
  });

  it('maps SYSTEM_INTERNAL_ERROR to 500', () => {
    try {
      AppException.throw('SYSTEM_INTERNAL_ERROR', 'internal');
    } catch (e) {
      expect((e as BusinessException).status).toBe(500);
    }
  });

  it('defaults to 500 for unknown codes', () => {
    try {
      AppException.throw('UNKNOWN_CODE', 'something');
    } catch (e) {
      expect((e as BusinessException).status).toBe(500);
    }
  });

  it('preserves the message in the exception', () => {
    try {
      AppException.throw('RESOURCE_NOT_FOUND', 'my message');
    } catch (e) {
      expect((e as BusinessException).message).toBe('my message');
    }
  });
});
