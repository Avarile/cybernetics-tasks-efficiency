import { HttpStatus } from '@nestjs/common';

export const ERROR_CATALOG = {
  DATABASE_QUERY_FAILED: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database operation failed' },
  RESOURCE_NOT_FOUND:    { status: HttpStatus.NOT_FOUND,             message: 'Resource not found' },
  RESOURCE_CONFLICT:     { status: HttpStatus.CONFLICT,              message: 'Resource already exists' },
  VALIDATION_FAILED:     { status: HttpStatus.BAD_REQUEST,           message: 'Validation failed' },
  UNAUTHORIZED:          { status: HttpStatus.UNAUTHORIZED,          message: 'Authentication required' },
  FORBIDDEN:             { status: HttpStatus.FORBIDDEN,             message: 'You do not have permission to perform this action' },
  SYSTEM_INTERNAL_ERROR: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' },
  SERVICE_UNAVAILABLE:   { status: HttpStatus.SERVICE_UNAVAILABLE,   message: 'Service temporarily unavailable' },
} as const satisfies Record<string, { status: HttpStatus; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export class BusinessException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

export class AppException {
  static throw(code: ErrorCode, message?: string, metadata?: Record<string, unknown>): never;
  static throw(code: ErrorCode, metadata: Record<string, unknown>): never;
  static throw(
    code: ErrorCode,
    a?: string | Record<string, unknown>,
    b?: Record<string, unknown>,
  ): never {
    const def = ERROR_CATALOG[code];
    const [message, metadata] = typeof a === 'string' ? [a, b] : [def.message, a];
    throw new BusinessException(code, message ?? def.message, def.status, metadata);
  }

  static notFound(entity: string, idOrSlug?: string | number): never {
    const message = idOrSlug == null ? `${entity} not found` : `${entity} ${idOrSlug} not found`;
    AppException.throw('RESOURCE_NOT_FOUND', message, { entity, id: idOrSlug });
  }

  static isBusinessException(error: unknown): error is BusinessException {
    return error instanceof BusinessException;
  }
}
