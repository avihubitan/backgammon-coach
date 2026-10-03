import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccountsController, isAccountCreation } from './accounts/accounts.controller';
import { AccountGuard } from './common/account.guard';
import { APP_CONFIG, type AppConfig } from './config';
import { HealthController } from './health/health.controller';
import { ProgressController } from './progress/progress.controller';
import { StorageModule } from './storage/storage.module';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        StorageModule.forRoot(config),
        ThrottlerModule.forRoot([
          {
            ttl: 60_000,
            limit: (context) =>
              isAccountCreation(context) ? config.rateLimit.newAccountsPerMinute : config.rateLimit.perMinute,
          },
        ]),
      ],
      controllers: [HealthController, AccountsController, ProgressController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        AccountGuard,
      ],
    };
  }
}
