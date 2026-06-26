import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    cors: { origin: ['http://localhost:5173'], credentials: true },
  });
  app.setGlobalPrefix('api');
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 9100);
}
bootstrap();
