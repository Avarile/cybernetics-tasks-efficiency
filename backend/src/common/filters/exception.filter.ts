import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BusinessException } from 'src/utils/exception.provider';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status_code = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'SYSTEM_INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof BusinessException) {
      status_code = exception.status;
      error = exception.code;
      if (status_code >= HttpStatus.INTERNAL_SERVER_ERROR) {
        // 5xx: log internal detail (including metadata) server-side; return a
        // generic message to the client so internals are never leaked.
        const meta = exception.metadata ? ` ${JSON.stringify(exception.metadata)}` : '';
        this.logger.error(
          `${error} on ${req?.method ?? ''} ${req?.url ?? ''}: ${exception.message}${meta}`,
          exception.stack,
        );
        message = 'Internal server error';
      } else {
        // 4xx: message is user-facing and safe to expose; not logged (routine).
        message = exception.message;
      }
    } else if (exception instanceof HttpException) {
      status_code = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
        error = HttpStatus[status_code] as string;
      } else {
        const respObj = resp as { message?: string | string[]; error?: string };
        message = Array.isArray(respObj.message)
          ? respObj.message.join(', ')
          : (respObj.message ?? exception.message);
        error = (respObj.error as string) || (HttpStatus[status_code] as string);
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `Unhandled exception on ${req?.method ?? ''} ${req?.url ?? ''}: ${err.message}`,
        err.stack,
      );
    }

    res.status(status_code).json({
      data: null,
      status_code,
      message,
      error,
      timestamp: new Date(),
    });
  }
}
