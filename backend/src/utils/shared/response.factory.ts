import { HttpStatus } from '@nestjs/common';
import { IBaseResponse } from './interface';

export function buildOk(data: unknown, message: string): IBaseResponse {
  return { data, status_code: HttpStatus.OK, message, timestamp: new Date(), error: null };
}

export function buildCreated(data: unknown, message: string): IBaseResponse {
  return { data, status_code: HttpStatus.CREATED, message, timestamp: new Date(), error: null };
}
