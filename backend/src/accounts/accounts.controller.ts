import { Controller, Get, HttpCode, Inject, Post, UseGuards, type ExecutionContext } from '@nestjs/common';

import { AccountGuard, CurrentAccount } from '../common/account.guard';
import { hashCode, newAccountId, newBackupCode, normalizeCode } from '../common/codes';
import { ACCOUNT_REPOSITORY, type Account, type AccountRepository } from '../storage/repositories';

export interface CreatedAccount {
  accountId: string;
  /** Shown once: the player keeps it to restore their progress on another device. */
  code: string;
}

/**
 * Anonymous accounts: no email, no name, no device identifiers. The backup
 * code is the only credential.
 */
@Controller('accounts')
export class AccountsController {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

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
}

/** Account creation gets a much stricter rate limit than everything else. */
export const isAccountCreation = (context: ExecutionContext) =>
  context.getClass() === AccountsController && context.getHandler() === AccountsController.prototype.create;
