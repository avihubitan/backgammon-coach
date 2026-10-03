import { Controller, Get, Inject } from '@nestjs/common';

import { STORAGE_KIND } from '../storage/repositories';

@Controller('health')
export class HealthController {
  constructor(@Inject(STORAGE_KIND) private readonly storage: 'memory' | 'mongo') {}

  @Get()
  check() {
    return { status: 'ok', storage: this.storage };
  }
}
