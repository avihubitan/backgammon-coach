import 'reflect-metadata';

import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { requestLog } from './common/request-log';
import type { AppConfig } from './config';

/** Builds the HTTP app exactly as production runs it (also used by the tests). */
export async function createApp(config: AppConfig): Promise<NestExpressApplication> {
  const env = process.env.NODE_ENV;
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bodyParser: false,
    // One JSON object per line in production, for the hosting platform's log search.
    logger: env === 'test' ? false : env === 'production' ? new ConsoleLogger({ json: true }) : undefined,
  });
  if (env !== 'test') app.use(requestLog(new Logger('HTTP')));
  app.useBodyParser('json', { limit: config.bodyLimit });
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false });
  app.disable('x-powered-by');
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);
  app.enableShutdownHooks();
  return app;
}
