import { emptyLessonRecord } from '@/features/learning/progression';
import { initialProgress } from '@/features/learning/progressModel';
import { useChallengeStore } from '@/state/challengeStore';
import { useMistakesStore } from '@/state/mistakesStore';
import { usePracticeStore } from '@/state/practiceStore';
import { useProgressStore } from '@/state/progressStore';
import { useSyncStore } from '@/state/syncStore';

import type { RemoteProgress, SyncApi } from '../api';
import { memoryCredentials } from '../credentials';
import type { SyncSnapshot } from '../snapshot';
import { createSyncService } from '../syncService';

/** A stand-in for the API with the same rules: one snapshot per account, optimistic revisions. */
function fakeServer() {
  const accounts = new Map<string, string>();
  const progress = new Map<string, RemoteProgress>();
  let next = 0;
  const calls: string[] = [];
  const account = (code: string) => {
    const id = accounts.get(code);
    if (!id) throw Object.assign(new Error('unknown code'), { status: 401 });
    return id;
  };
  const api: SyncApi = {
    async createAccount() {
      calls.push('create');
      next += 1;
      const code = `CODE-${next}`;
      accounts.set(code, `account-${next}`);
      return { accountId: `account-${next}`, code };
    },
    async me(code) {
      calls.push('me');
      return { accountId: account(code) };
    },
    async getProgress(code) {
      calls.push('get');
      return structuredClone(progress.get(account(code)) ?? { revision: 0, updatedAt: null, snapshot: null });
    },
    async putProgress(code, baseRevision, snapshot) {
      calls.push('put');
      const id = account(code);
      const current = progress.get(id) ?? { revision: 0, updatedAt: null, snapshot: null };
      if (current.revision !== baseRevision) return { ok: false, current: structuredClone(current) };
      progress.set(id, { revision: baseRevision + 1, updatedAt: 'now', snapshot: structuredClone(snapshot) });
      return { ok: true, revision: baseRevision + 1 };
    },
  };
  return { api, calls, stored: (accountId: string) => progress.get(accountId), accounts };
}

const completed = (stars = 3) => ({ ...emptyLessonRecord(), completed: true, bestStars: stars });

function resetStores() {
  useProgressStore.setState(initialProgress());
  usePracticeStore.setState({ records: {} });
  useChallengeStore.setState({ completedDays: {} });
  useMistakesStore.setState({ mistakes: [] });
  useSyncStore.getState().reset();
}

let clock = 0;
const now = () => new Date(Date.UTC(2026, 9, 3, 10, 0, clock++));

beforeEach(() => {
  resetStores();
  clock = 0;
});

describe('cloud backup', () => {
  it('stays off and silent without a server', async () => {
    const service = createSyncService({ api: null, credentials: memoryCredentials(), now });
    expect(service.isConfigured()).toBe(false);
    await expect(service.enable()).rejects.toThrow();
    await service.syncNow();
    expect(useSyncStore.getState().enabled).toBe(false);
  });

  it('creates an anonymous account and uploads the current progress', async () => {
    const server = fakeServer();
    const credentials = memoryCredentials();
    useProgressStore.setState({ xp: 42, lessons: { 'board-1': completed() } });
    const service = createSyncService({ api: server.api, credentials, now });

    await service.enable();

    expect(await credentials.getCode()).toBe('CODE-1');
    expect(useSyncStore.getState()).toMatchObject({ enabled: true, accountId: 'account-1', revision: 1, status: 'idle' });
    const stored = server.stored('account-1')!.snapshot as SyncSnapshot;
    expect(stored.progress.xp).toBe(42);
    expect(stored.progress.lessons['board-1'].completed).toBe(true);
  });

  it('does not upload again when nothing changed', async () => {
    const server = fakeServer();
    const service = createSyncService({ api: server.api, credentials: memoryCredentials(), now });
    await service.enable();
    const puts = server.calls.filter((call) => call === 'put').length;
    await service.syncNow();
    expect(server.calls.filter((call) => call === 'put').length).toBe(puts);
    useProgressStore.setState({ xp: 7 });
    await service.syncNow();
    expect(server.calls.filter((call) => call === 'put').length).toBe(puts + 1);
  });

  it('merges with another device’s upload and tries again', async () => {
    const server = fakeServer();
    const credentials = memoryCredentials();
    const service = createSyncService({ api: server.api, credentials, now });
    useProgressStore.setState({ lessons: { 'board-1': completed() } });
    await service.enable();

    // Meanwhile, another device with the same code finished a different lesson.
    const other = structuredClone(server.stored('account-1')!.snapshot) as SyncSnapshot;
    other.progress.lessons['board-2'] = completed(2);
    other.progress.xp = 99;
    await server.api.putProgress('CODE-1', 1, other);

    // This device finishes another lesson and syncs: the server says 409, we merge and retry.
    useProgressStore.setState({ lessons: { ...useProgressStore.getState().lessons, 'moving-1': completed(1) } });
    await service.syncNow();

    const stored = server.stored('account-1')!;
    expect(stored.revision).toBe(3);
    const lessons = (stored.snapshot as SyncSnapshot).progress.lessons;
    expect(Object.keys(lessons).sort()).toEqual(['board-1', 'board-2', 'moving-1']);
    // And this device now has the other device's lesson and XP too.
    expect(useProgressStore.getState().lessons['board-2'].completed).toBe(true);
    expect(useProgressStore.getState().xp).toBe(99);
    expect(useSyncStore.getState()).toMatchObject({ revision: 3, status: 'idle', error: null });
  });

  it('restores a backup on a new device by merging it with local progress', async () => {
    const server = fakeServer();
    // Device A backs up.
    const deviceA = createSyncService({ api: server.api, credentials: memoryCredentials(), now });
    useProgressStore.setState({ xp: 300, lessons: { 'board-1': completed(), 'board-2': completed() } });
    await deviceA.enable();

    // Device B starts fresh, plays one lesson, then restores with A's code.
    resetStores();
    useProgressStore.setState({ xp: 20, lessons: { 'board-1': completed(1) } });
    const credentialsB = memoryCredentials();
    const deviceB = createSyncService({ api: server.api, credentials: credentialsB, now });
    await deviceB.restore('  CODE-1 ');

    expect(await credentialsB.getCode()).toBe('CODE-1');
    expect(useProgressStore.getState().xp).toBe(300);
    expect(useProgressStore.getState().lessons['board-1'].bestStars).toBe(3);
    expect(useProgressStore.getState().lessons['board-2'].completed).toBe(true);
    expect(useSyncStore.getState()).toMatchObject({ enabled: true, accountId: 'account-1' });
  });

  it('refuses an unknown code without touching local progress', async () => {
    const server = fakeServer();
    useProgressStore.setState({ xp: 5 });
    const service = createSyncService({ api: server.api, credentials: memoryCredentials(), now });
    await expect(service.restore('NOPE')).rejects.toThrow();
    expect(useProgressStore.getState().xp).toBe(5);
    expect(useSyncStore.getState().enabled).toBe(false);
  });

  it('pulls other devices’ progress when asked, without uploading if nothing new was added', async () => {
    const server = fakeServer();
    const credentials = memoryCredentials();
    const service = createSyncService({ api: server.api, credentials, now });
    await service.enable();
    const other = structuredClone(server.stored('account-1')!.snapshot) as SyncSnapshot;
    other.progress.lessons['board-3'] = completed();
    await server.api.putProgress('CODE-1', 1, other);
    const puts = server.calls.filter((call) => call === 'put').length;

    await service.syncNow({ pull: true });

    expect(useProgressStore.getState().lessons['board-3'].completed).toBe(true);
    expect(server.calls.filter((call) => call === 'put').length).toBe(puts);
    expect(useSyncStore.getState().revision).toBe(2);
  });

  it('reports errors and recovers on the next sync', async () => {
    const server = fakeServer();
    const credentials = memoryCredentials();
    let offline = false;
    const api: SyncApi = {
      ...server.api,
      putProgress: (...args) => (offline ? Promise.reject(new Error('offline')) : server.api.putProgress(...args)),
    };
    const service = createSyncService({ api, credentials, now });
    await service.enable();
    offline = true;
    useProgressStore.setState({ xp: 11 });
    await service.syncNow();
    expect(useSyncStore.getState().status).toBe('error');
    offline = false;
    await service.syncNow();
    expect(useSyncStore.getState()).toMatchObject({ status: 'idle', error: null });
    expect((server.stored('account-1')!.snapshot as SyncSnapshot).progress.xp).toBe(11);
  });
});
