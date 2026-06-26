import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((body) => {
        // Pass through controller responses that already use the envelope
        if (body && typeof body === 'object' && 'status_code' in body && 'error' in body)
          return body;
        // Normalise any bare return into the standard IBaseResponse envelope
        return {
          data: body ?? null,
          status_code: HttpStatus.OK,
          message: 'OK',
          error: null,
          timestamp: new Date(),
        };
      }),
    );
  }
}
