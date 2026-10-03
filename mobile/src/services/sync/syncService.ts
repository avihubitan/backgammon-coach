import { AppState } from 'react-native';

import { useSyncStore } from '@/state/syncStore';

import { createHttpSyncApi, SyncApiError, type SyncApi } from './api';
import { deviceCredentials, type CredentialStore } from './credentials';
import { contentKey, isSnapshot, mergeSnapshots, type SyncSnapshot } from './snapshot';
import { applySnapshot, snapshotFromStores, subscribeToSyncedData } from './stores';

export interface SyncDeps {
  /** Null when no backend is configured: the feature stays hidden. */
  api: SyncApi | null;
  credentials: CredentialStore;
  now?: () => Date;
  /** Wait after a change before uploading, so a burst of changes is one upload. */
  debounceMs?: number;
}

/** Uploads retried after merging with a newer copy from another device. */
const MAX_ATTEMPTS = 3;

const message = (error: unknown) =>
  error instanceof SyncApiError ? error.message : 'Something went wrong while backing up.';

/** Shown when another device deleted the backup this one was linked to. */
export const BACKUP_GONE = 'This backup was deleted. Turn backup on to start a new one.';

/**
 * Cloud backup. Progress stays on the device first; when backup is on, a
 * snapshot is uploaded after changes. If another device uploaded in the
 * meantime, the two copies are merged here and the upload is retried.
 */
export function createSyncService({ api, credentials, now = () => new Date(), debounceMs = 2500 }: SyncDeps) {
  const store = useSyncStore;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const finish = (key: string, revision: number) =>
    store.getState().update({
      revision,
      lastSyncedAt: now().toISOString(),
      lastContentKey: key,
      status: 'idle',
      error: null,
    });

  async function run(code: string, pull: boolean): Promise<void> {
    let local = snapshotFromStores(now());
    let revision = store.getState().revision;

    if (pull) {
      // Pick up what other devices uploaded since we last looked.
      const remote = await api!.getProgress(code);
      if (remote.revision !== revision && isSnapshot(remote.snapshot)) {
        const merged = mergeSnapshots(local, remote.snapshot);
        if (contentKey(merged) !== contentKey(local)) applySnapshot(merged);
        local = merged;
        revision = remote.revision;
        store.getState().update({ revision });
        if (contentKey(merged) === contentKey(remote.snapshot)) {
          finish(contentKey(merged), revision);
          return;
        }
      }
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const key = contentKey(local);
      if (attempt === 0 && key === store.getState().lastContentKey && revision === store.getState().revision) {
        // Nothing changed since the last upload.
        store.getState().update({ status: 'idle', error: null });
        return;
      }
      const result = await api!.putProgress(code, revision, local);
      if (result.ok) {
        finish(key, result.revision);
        return;
      }
      // Another device got there first: fold its copy into ours and try again.
      revision = result.current.revision;
      if (isSnapshot(result.current.snapshot)) {
        local = mergeSnapshots(local, result.current.snapshot);
        applySnapshot(local);
      }
      store.getState().update({ revision });
    }
    throw new SyncApiError('Your progress changed on another device. We’ll try again shortly.', 409);
  }

  /**
   * Runs one sync (or queues another if one is running). `pull` first fetches
   * the stored copy; otherwise only local changes are pushed.
   */
  async function syncNow({ pull = false }: { pull?: boolean } = {}): Promise<void> {
    if (!api || !store.getState().enabled) return;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        let pullNow = pull;
        do {
          again = false;
          const code = await credentials.getCode();
          if (!code) {
            store.getState().update({ enabled: false, status: 'idle' });
            return;
          }
          store.getState().update({ status: 'syncing', error: null });
          await run(code, pullNow);
          pullNow = false;
        } while (again);
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 401) {
          // The code no longer opens a backup: it was deleted, from here or another device.
          await unlink();
          store.getState().update({ error: BACKUP_GONE });
        } else {
          store.getState().update({ status: 'error', error: message(error) });
        }
      } finally {
        running = null;
      }
    })();
    return running;
  }

  /** Forgets the backup on this device. Progress stays; turning backup on starts a new one. */
  async function unlink() {
    if (timer) clearTimeout(timer);
    timer = null;
    await credentials.clear();
    store.getState().reset();
  }

  function requestSync() {
    if (!api || !store.getState().enabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncNow();
    }, debounceMs);
  }

  return {
    isConfigured: () => api !== null,

    /** Turns backup on, creating an anonymous account the first time. */
    async enable(): Promise<void> {
      if (!api) throw new SyncApiError('Backup isn’t available in this build.', null);
      let code = await credentials.getCode();
      if (!code) {
        const account = await api.createAccount();
        code = account.code;
        await credentials.setCode(code);
        store.getState().update({ accountId: account.accountId, revision: 0, lastContentKey: null });
      }
      store.getState().update({ enabled: true });
      await syncNow();
    },

    /** Stops uploading. The account and its code are kept, so turning it back on resumes. */
    disable() {
      if (timer) clearTimeout(timer);
      store.getState().update({ enabled: false, status: 'idle', error: null });
    },

    /** Links this device to an existing backup and merges it with what's here. */
    async restore(code: string): Promise<void> {
      if (!api) throw new SyncApiError('Backup isn’t available in this build.', null);
      const trimmed = code.trim();
      const account = await api.me(trimmed);
      const remote = await api.getProgress(trimmed);
      if (isSnapshot(remote.snapshot)) {
        const merged: SyncSnapshot = mergeSnapshots(snapshotFromStores(now()), remote.snapshot);
        applySnapshot(merged);
      }
      await credentials.setCode(trimmed);
      store.getState().update({
        enabled: true,
        accountId: account.accountId,
        revision: remote.revision,
        lastContentKey: null,
      });
      await syncNow();
    },

    /**
     * Deletes the backup and its code from the server, then forgets it here.
     * Progress on this device stays. Other devices using the code stop backing up.
     */
    async deleteBackup(): Promise<void> {
      if (!api) throw new SyncApiError('Backup isn’t available in this build.', null);
      const wasEnabled = store.getState().enabled;
      // No new uploads from here on; let one in progress finish first.
      store.getState().update({ enabled: false });
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        await running;
        const code = await credentials.getCode();
        if (code) await api.deleteAccount(code);
      } catch (error) {
        store.getState().update({ enabled: wasEnabled });
        throw error;
      }
      await unlink();
    },

    /** The backup code, to show the player when they ask for it. */
    revealCode: () => credentials.getCode(),

    syncNow,
    requestSync,

    /** Syncs at startup, after changes and when the app goes to the background. */
    start(): () => void {
      if (!api) return () => {};
      void syncNow({ pull: true });
      const unsubscribe = subscribeToSyncedData(requestSync);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'background') void syncNow();
      });
      return () => {
        unsubscribe();
        subscription.remove();
      };
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const syncService = createSyncService({
  api: API_URL ? createHttpSyncApi(API_URL) : null,
  credentials: deviceCredentials,
});
