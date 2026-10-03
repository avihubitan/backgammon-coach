import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import type { AppConfig } from './config';

/** Builds the HTTP app exactly as production runs it (also used by the tests). */
export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'test' ? false : undefined,
  });
  app.useBodyParser('json', { limit: config.bodyLimit });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false });
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  return app;
}
