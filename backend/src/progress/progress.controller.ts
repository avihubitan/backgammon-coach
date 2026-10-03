import { Body, ConflictException, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';

import { AccountGuard, CurrentAccount } from '../common/account.guard';
import { ZodPipe } from '../common/zod.pipe';
import { PROGRESS_REPOSITORY, type Account, type ProgressRepository, type StoredProgress } from '../storage/repositories';
import { PutProgressSchema, type PutProgressBody } from './progress.schema';

const view = (stored: StoredProgress | null) => ({
  revision: stored?.revision ?? 0,
  updatedAt: stored?.updatedAt.toISOString() ?? null,
  snapshot: stored?.snapshot ?? null,
});

/** One progress snapshot per account, with optimistic concurrency. */
@Controller('progress')
@UseGuards(AccountGuard)
export class ProgressController {
  constructor(@Inject(PROGRESS_REPOSITORY) private readonly progress: ProgressRepository) {}

  @Get()
  async get(@CurrentAccount() account: Account) {
    return view(await this.progress.get(account.id));
  }

  /**
   * Stores the snapshot if `baseRevision` is current. Otherwise answers 409
   * with what's stored, so the device can merge and try again.
   */
  @Put()
  async put(@CurrentAccount() account: Account, @Body(new ZodPipe(PutProgressSchema)) body: PutProgressBody) {
    const result = await this.progress.put(account.id, body.baseRevision, body.snapshot, new Date());
    if (!result.ok) {
      throw new ConflictException({ statusCode: 409, message: 'A newer snapshot is stored', ...view(result.current) });
    }
    return { revision: result.stored.revision, updatedAt: result.stored.updatedAt.toISOString() };
  }
}
