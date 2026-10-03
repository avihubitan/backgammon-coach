import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import type { AppConfig } from '../config';
import { MemoryAccountRepository, MemoryProgressRepository } from './memory.repositories';
import { MongoAccountRepository, MongoProgressRepository } from './mongo.repositories';
import { ACCOUNT_REPOSITORY, PROGRESS_REPOSITORY, STORAGE_KIND } from './repositories';

const MONGO_CLIENT = Symbol('MONGO_CLIENT');

/** Closes the MongoDB connection when the app shuts down. */
class MongoLifecycle implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient | null) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client?.close();
  }
}

/**
 * Picks the storage backend: MongoDB when a connection string is configured,
 * memory otherwise (development and tests).
 */
@Global()
@Module({})
export class StorageModule {
  static forRoot(config: AppConfig): DynamicModule {
    const logger = new Logger('Storage');
    return {
      module: StorageModule,
      providers: [
        {
          provide: MONGO_CLIENT,
          useFactory: async () => {
            if (!config.mongoUri) {
              logger.warn('MONGODB_URI is not set: keeping data in memory. Do not use this in production.');
              return null;
            }
            const client = new MongoClient(config.mongoUri);
            await client.connect();
            return client;
          },
        },
        {
          provide: STORAGE_KIND,
          useFactory: (client: MongoClient | null) => (client ? 'mongo' : 'memory'),
          inject: [MONGO_CLIENT],
        },
        {
          provide: ACCOUNT_REPOSITORY,
          useFactory: async (client: MongoClient | null) => {
            if (!client) return new MemoryAccountRepository();
            const repository = new MongoAccountRepository(client.db(config.mongoDb));
            await repository.init();
            return repository;
          },
          inject: [MONGO_CLIENT],
        },
        {
          provide: PROGRESS_REPOSITORY,
          useFactory: (client: MongoClient | null) =>
            client ? new MongoProgressRepository(client.db(config.mongoDb)) : new MemoryProgressRepository(),
          inject: [MONGO_CLIENT],
        },
        MongoLifecycle,
      ],
      exports: [ACCOUNT_REPOSITORY, PROGRESS_REPOSITORY, STORAGE_KIND],
    };
  }
}
