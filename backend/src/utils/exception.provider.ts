import { HttpStatus } from '@nestjs/common';

const CODE_STATUS: Record<string, number> = {
  DATABASE_QUERY_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  RESOURCE_NOT_FOUND: HttpStatus.NOT_FOUND,
  RESOURCE_CONFLICT: HttpStatus.CONFLICT,
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  SYSTEM_INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

export class BusinessException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

export class AppException {
  static throw(code: keyof typeof CODE_STATUS | string, message: string): never {
    throw new BusinessException(code, message, CODE_STATUS[code] ?? 500);
  }
}
