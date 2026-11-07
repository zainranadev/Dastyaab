import { ValidationError, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppException } from './common/errors/app-exception';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor, ResponseInterceptor } from './common/interceptors';
import { requestId } from './common/middleware/request-id';

function flatten(errors: ValidationError[], parent = ''): { field: string; messages: string[] }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function configureApp(app: NestExpressApplication, corsOrigin = 'http://localhost:3001') {
  // Decimal columns (avg_rating, lat/long) serialize as plain numbers, not strings.
  Object.defineProperty(Prisma.Decimal.prototype, 'toJSON', {
    value(this: Prisma.Decimal) {
      return this.toNumber();
    },
    configurable: true,
  });

  app.use(requestId);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new AppException(400, 'VALIDATION_ERROR', 'Validation failed', flatten(errors)),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
}
