import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, map, tap } from 'rxjs';
import { Paginated } from '../dto/pagination.dto';

/** Wraps every success response as `{ data }` or `{ data, meta }`. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) =>
        result instanceof Paginated ? { data: result.items, meta: result.meta } : { data: result ?? null },
      ),
    );
  }
}

/** One log line per request, always carrying the request ID. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`),
      }),
    );
  }
}
