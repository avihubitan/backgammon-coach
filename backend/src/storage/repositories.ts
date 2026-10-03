/** Storage contracts. The API depends only on these; MongoDB or memory implement them. */

export interface Account {
  id: string;
  /** SHA-256 of the normalized backup code. */
  codeHash: string;
  createdAt: Date;
}

/** The player's progress snapshot, as last uploaded by one of their devices. */
export interface StoredProgress {
  /** Increments on every accepted upload; 0 means nothing stored yet. */
  revision: number;
  updatedAt: Date;
  snapshot: Record<string, unknown>;
}

export type PutResult =
  | { ok: true; stored: StoredProgress }
  /** Someone uploaded first: here is what's stored now, to merge and retry. */
  | { ok: false; current: StoredProgress | null };

export interface AccountRepository {
  create(account: Account): Promise<void>;
  findByCodeHash(codeHash: string): Promise<Account | null>;
  /** Removes the account; its code stops working. No-op when it doesn't exist. */
  delete(id: string): Promise<void>;
}

export interface ProgressRepository {
  get(accountId: string): Promise<StoredProgress | null>;
  /** Stores the snapshot only if the stored revision is still `baseRevision` (optimistic concurrency). */
  put(accountId: string, baseRevision: number, snapshot: Record<string, unknown>, now: Date): Promise<PutResult>;
  /** Removes the stored snapshot. No-op when there is none. */
  delete(accountId: string): Promise<void>;
}

/** Checks the storage can be reached (for the health check). */
export const STORAGE_PING = Symbol('STORAGE_PING');
export type StoragePing = () => Promise<boolean>;

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
export const PROGRESS_REPOSITORY = Symbol('PROGRESS_REPOSITORY');
/** 'memory' or 'mongo', for the health check. */
export const STORAGE_KIND = Symbol('STORAGE_KIND');
