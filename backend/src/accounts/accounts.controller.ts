import { Controller, Delete, Get, HttpCode, Inject, Post, UseGuards, type ExecutionContext } from '@nestjs/common';

import { AccountGuard, CurrentAccount } from '../common/account.guard';
import { hashCode, newAccountId, newBackupCode, normalizeCode } from '../common/codes';
import {
  ACCOUNT_REPOSITORY,
  PROGRESS_REPOSITORY,
  type Account,
  type AccountRepository,
  type ProgressRepository,
} from '../storage/repositories';

export interface CreatedAccount {
  accountId: string;
  /** Shown once: the player keeps it to restore their progress on another device. */
  code: string;
}

/**
 * Anonymous accounts: no email, no name, no device identifiers. The backup
 * code is the only credential, and its holder can delete everything.
 */
@Controller('accounts')
export class AccountsController {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(PROGRESS_REPOSITORY) private readonly progress: ProgressRepository,
  ) {}

  @Post()
  @HttpCode(201)
  async create(): Promise<CreatedAccount> {
    const code = newBackupCode();
    const account: Account = { id: newAccountId(), codeHash: hashCode(normalizeCode(code)!), createdAt: new Date() };
    await this.accounts.create(account);
    return { accountId: account.id, code };
  }

  @Get('me')
  @UseGuards(AccountGuard)
  me(@CurrentAccount() account: Account) {
    return { accountId: account.id, createdAt: account.createdAt.toISOString() };
  }

  /** Deletes the backup and the account. The code stops working on every device. */
  @Delete('me')
  @HttpCode(204)
  @UseGuards(AccountGuard)
  async remove(@CurrentAccount() account: Account): Promise<void> {
    // Progress first: if the second step fails, the code still works to try again.
    await this.progress.delete(account.id);
    await this.accounts.delete(account.id);
  }
}

/** Account creation gets a much stricter rate limit than everything else. */
export const isAccountCreation = (context: ExecutionContext) =>
  context.getClass() === AccountsController && context.getHandler() === AccountsController.prototype.create;
