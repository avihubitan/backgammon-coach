import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { ACCOUNT_REPOSITORY, type Account, type AccountRepository } from '../storage/repositories';
import { hashCode, normalizeCode } from './codes';

type AuthedRequest = Request & { account?: Account };

/** `Authorization: Bearer <backup code>` identifies the account. */
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const code = match ? normalizeCode(match[1]) : null;
    if (!code) throw new UnauthorizedException('Missing or malformed backup code');
    const account = await this.accounts.findByCodeHash(hashCode(code));
    if (!account) throw new UnauthorizedException('Unknown backup code');
    request.account = account;
    return true;
  }
}

/** The account resolved by AccountGuard. */
export const CurrentAccount = createParamDecorator((_data: unknown, context: ExecutionContext): Account => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  return request.account!;
});
