import type { Collection, Db } from 'mongodb';

import type { Account, AccountRepository, ProgressRepository, PutResult, StoredProgress } from './repositories';

interface AccountDocument {
  _id: string;
  codeHash: string;
  createdAt: Date;
}

interface ProgressDocument {
  _id: string;
  revision: number;
  updatedAt: Date;
  snapshot: Record<string, unknown>;
}

const DUPLICATE_KEY = 11000;
const isDuplicateKey = (error: unknown) => (error as { code?: number } | null)?.code === DUPLICATE_KEY;

export class MongoAccountRepository implements AccountRepository {
  private readonly accounts: Collection<AccountDocument>;

  constructor(db: Db) {
    this.accounts = db.collection<AccountDocument>('accounts');
  }

  async init(): Promise<void> {
    await this.accounts.createIndex({ codeHash: 1 }, { unique: true });
  }

  async create(account: Account): Promise<void> {
    await this.accounts.insertOne({ _id: account.id, codeHash: account.codeHash, createdAt: account.createdAt });
  }

  async findByCodeHash(codeHash: string): Promise<Account | null> {
    const found = await this.accounts.findOne({ codeHash });
    return found ? { id: found._id, codeHash: found.codeHash, createdAt: found.createdAt } : null;
  }
}

export class MongoProgressRepository implements ProgressRepository {
  private readonly progress: Collection<ProgressDocument>;

  constructor(db: Db) {
    this.progress = db.collection<ProgressDocument>('progress');
  }

  async get(accountId: string): Promise<StoredProgress | null> {
    const found = await this.progress.findOne({ _id: accountId });
    return found ? toStored(found) : null;
  }

  async put(accountId: string, baseRevision: number, snapshot: Record<string, unknown>, now: Date): Promise<PutResult> {
    if (baseRevision === 0) {
      // First upload: only succeeds if nothing is stored yet.
      try {
        const document: ProgressDocument = { _id: accountId, revision: 1, updatedAt: now, snapshot };
        await this.progress.insertOne(document);
        return { ok: true, stored: toStored(document) };
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        return { ok: false, current: await this.get(accountId) };
      }
    }
    const updated = await this.progress.findOneAndUpdate(
      { _id: accountId, revision: baseRevision },
      { $set: { snapshot, updatedAt: now }, $inc: { revision: 1 } },
      { returnDocument: 'after' },
    );
    if (updated) return { ok: true, stored: toStored(updated) };
    return { ok: false, current: await this.get(accountId) };
  }
}

function toStored(document: ProgressDocument): StoredProgress {
  return { revision: document.revision, updatedAt: document.updatedAt, snapshot: document.snapshot };
}
