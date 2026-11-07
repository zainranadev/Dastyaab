import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('backend')
      .setDescription('Describe the problem. Get it fixed.')
      .setVersion('0.1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);

  app.enableShutdownHooks();
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  console.log(`API:     http://localhost:${port}/api/v1\nSwagger: http://localhost:${port}/api/docs`);
}
bootstrap();
