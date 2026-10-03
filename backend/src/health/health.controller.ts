import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';

import { STORAGE_KIND, STORAGE_PING, type StoragePing } from '../storage/repositories';

/** For load balancers and uptime checks: 200 when the API and its database answer, 503 otherwise. */
@Controller('health')
export class HealthController {
  constructor(
    @Inject(STORAGE_KIND) private readonly storage: 'memory' | 'mongo',
    @Inject(STORAGE_PING) private readonly ping: StoragePing,
  ) {}

  @Get()
  async check() {
    if (!(await this.ping())) {
      throw new ServiceUnavailableException({ status: 'unavailable', storage: this.storage });
    }
    return { status: 'ok', storage: this.storage };
  }
}
