import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import env from './utils/env';

async function bootstrap() {
  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    cors: { origin: corsOrigins, credentials: true },
  });
  app.setGlobalPrefix('api');
  // URI versioning: routes live under /api/v1/... by default. Controllers can
  // opt a route out with @Version(VERSION_NEUTRAL) (e.g. health probes).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Cybernetic API')
    .setDescription('OKR + AI efficiency engine API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(env.PORT ?? 9100);
}
bootstrap();
