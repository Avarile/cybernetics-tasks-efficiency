import { BadRequestException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './exception.filter';
import { BusinessException } from 'src/utils/exception.provider';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/x', method: 'GET', headers: {} }),
    }),
  } as any;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('handles ValidationPipe BadRequestException with joined messages', () => {
    const { host, status, json } = makeHost();
    const exc = new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.status_code).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('email must be an email');
    expect(body.message).toContain('name should not be empty');
    expect(body.data).toBeNull();
  });

  it('handles BusinessException with code and status', () => {
    const { host, status, json } = makeHost();
    const exc = new BusinessException('RESOURCE_NOT_FOUND', 'nope', 404);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body.status_code).toBe(404);
    expect(body.error).toBe('RESOURCE_NOT_FOUND');
    expect(body.message).toBe('nope');
    expect(body.data).toBeNull();
  });

  it('handles a plain HttpException with string response', () => {
    const { host, status, json } = makeHost();
    const { HttpException, HttpStatus } = require('@nestjs/common');
    const exc = new HttpException('Not found here', HttpStatus.NOT_FOUND);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body.status_code).toBe(404);
    expect(body.message).toBe('Not found here');
    expect(body.error).toBe('NOT_FOUND');
  });

  it('handles generic Error without leaking details to client', () => {
    const { host, status, json } = makeHost();
    const exc = new Error('DB connection refused');

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.status_code).toBe(500);
    expect(body.error).toBe('SYSTEM_INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
    expect(body.message).not.toContain('DB connection refused');
  });

  it('logs metadata in the 5xx error line but never sends it to the client', () => {
    const { host, status, json } = makeHost();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const exc = new BusinessException('DATABASE_QUERY_FAILED', 'db error', 500, { cause: 'timeout' });

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    // metadata must not appear in the response envelope
    expect(JSON.stringify(body)).not.toContain('timeout');
    // metadata must appear in the server-side log
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"cause":"timeout"'),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it('does not log 4xx BusinessException (routine, not an error)', () => {
    const { host } = makeHost();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const exc = new BusinessException('RESOURCE_NOT_FOUND', 'not found', 404);

    filter.catch(exc, host);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
