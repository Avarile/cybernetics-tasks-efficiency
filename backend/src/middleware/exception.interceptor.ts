import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BusinessException } from 'src/utils/exception.provider';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SYSTEM_INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof BusinessException) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = 'HTTP_ERROR';
    }

    res.status(status).json({
      data: null,
      status_code: status,
      message,
      error: code,
      timestamp: new Date(),
    });
  }
}
