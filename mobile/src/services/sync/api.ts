/** HTTP client for the Backgammon Coach API (see /backend). */

export interface RemoteProgress {
  revision: number;
  updatedAt: string | null;
  snapshot: unknown;
}

export type PutResult = { ok: true; revision: number } | { ok: false; current: RemoteProgress };

export interface SyncApi {
  createAccount(): Promise<{ accountId: string; code: string }>;
  me(code: string): Promise<{ accountId: string }>;
  getProgress(code: string): Promise<RemoteProgress>;
  putProgress(code: string, baseRevision: number, snapshot: object): Promise<PutResult>;
  /** Deletes the backup and the account on the server. Already gone counts as done. */
  deleteAccount(code: string): Promise<void>;
}

export class SyncApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or null when the server couldn't be reached. */
    readonly status: number | null,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 10_000;

export function createHttpSyncApi(baseUrl: string, fetchImpl: typeof fetch = fetch): SyncApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function call(path: string, init: RequestInit & { code?: string } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body) headers['Content-Type'] = 'application/json';
    if (init.code) headers.Authorization = `Bearer ${init.code}`;
    try {
      const response = await fetchImpl(`${root}/v1${path}`, { ...init, headers, signal: controller.signal });
      const body = await response.json().catch(() => null);
      return { status: response.status, body };
    } catch {
      throw new SyncApiError('The backup server can’t be reached right now.', null);
    } finally {
      clearTimeout(timer);
    }
  }

  const fail = (status: number): never => {
    if (status === 401) throw new SyncApiError('That backup code doesn’t match a backup.', 401);
    if (status === 429) throw new SyncApiError('Too many tries. Please wait a minute.', 429);
    throw new SyncApiError('The backup server had a problem. Please try again later.', status);
  };

  return {
    async createAccount() {
      const { status, body } = await call('/accounts', { method: 'POST' });
      if (status !== 201) fail(status);
      return { accountId: String(body.accountId), code: String(body.code) };
    },
    async me(code) {
      const { status, body } = await call('/accounts/me', { code });
      if (status !== 200) fail(status);
      return { accountId: String(body.accountId) };
    },
    async getProgress(code) {
      const { status, body } = await call('/progress', { code });
      if (status !== 200) fail(status);
      return { revision: Number(body.revision) || 0, updatedAt: body.updatedAt ?? null, snapshot: body.snapshot ?? null };
    },
    async putProgress(code, baseRevision, snapshot) {
      const { status, body } = await call('/progress', {
        method: 'PUT',
        code,
        body: JSON.stringify({ baseRevision, snapshot }),
      });
      if (status === 200) return { ok: true, revision: Number(body.revision) };
      if (status === 409) {
        return {
          ok: false,
          current: { revision: Number(body.revision) || 0, updatedAt: body.updatedAt ?? null, snapshot: body.snapshot ?? null },
        };
      }
      return fail(status);
    },
    async deleteAccount(code) {
      const { status } = await call('/accounts/me', { method: 'DELETE', code });
      // 401: the code no longer matches anything, which is what we wanted.
      if (status !== 204 && status !== 200 && status !== 401) fail(status);
    },
  };
}
