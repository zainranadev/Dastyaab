import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AppException, ErrorCode } from '../errors/app-exception';

interface ErrorBody {
  code: ErrorCode;
  message: string;
  details: unknown[];
}

const STATUS_CODE: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'DUPLICATE_RESOURCE',
  413: 'FILE_TOO_LARGE',
  415: 'UNSUPPORTED_FILE_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Every error leaves the API in the README's standard shape. Stack traces never leak. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const { status, body } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `[${req.id ?? '-'}] ${req.method} ${req.url} -> ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(status).json({ error: body });
  }

  private normalize(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), body: exception.getResponse() as ErrorBody };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return { status: 409, body: { code: 'DUPLICATE_RESOURCE', message: `Already exists (${target}).`, details: [] } };
      }
      if (exception.code === 'P2025') {
        return { status: 404, body: { code: 'NOT_FOUND', message: 'Resource not found', details: [] } };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: unknown[] = [];
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const m = (response as { message: unknown }).message;
        if (Array.isArray(m)) {
          message = 'Request failed';
          details = m;
        } else if (typeof m === 'string') {
          message = m;
        }
      }
      const code = STATUS_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');
      return { status, body: { code, message, details } };
    }

    return {
      status: 500,
      body: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', details: [] },
    };
  }
}
