import type { Account, AccountRepository, ProgressRepository, PutResult, StoredProgress } from './repositories';

/** In-memory storage for development and tests. Everything is lost on restart. */
export class MemoryAccountRepository implements AccountRepository {
  private readonly byHash = new Map<string, Account>();

  async create(account: Account): Promise<void> {
    if (this.byHash.has(account.codeHash)) throw new Error('Duplicate code');
    this.byHash.set(account.codeHash, { ...account });
  }

  async findByCodeHash(codeHash: string): Promise<Account | null> {
    const account = this.byHash.get(codeHash);
    return account ? { ...account } : null;
  }

  async delete(id: string): Promise<void> {
    for (const [hash, account] of this.byHash) if (account.id === id) this.byHash.delete(hash);
  }
}

export class MemoryProgressRepository implements ProgressRepository {
  private readonly byAccount = new Map<string, StoredProgress>();

  async get(accountId: string): Promise<StoredProgress | null> {
    const stored = this.byAccount.get(accountId);
    return stored ? structuredClone(stored) : null;
  }

  async put(accountId: string, baseRevision: number, snapshot: Record<string, unknown>, now: Date): Promise<PutResult> {
    const current = this.byAccount.get(accountId) ?? null;
    if ((current?.revision ?? 0) !== baseRevision) return { ok: false, current: current ? structuredClone(current) : null };
    const stored: StoredProgress = { revision: baseRevision + 1, updatedAt: now, snapshot: structuredClone(snapshot) };
    this.byAccount.set(accountId, stored);
    return { ok: true, stored: structuredClone(stored) };
  }

  async delete(accountId: string): Promise<void> {
    this.byAccount.delete(accountId);
  }
}
