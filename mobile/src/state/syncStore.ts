import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { mergeChecked } from './sanitize';
import { persistStorage } from './storage';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  /** The player turned on cloud backup. */
  enabled: boolean;
  accountId: string | null;
  /** Server revision this device last saw. */
  revision: number;
  lastSyncedAt: string | null;
  /** Fingerprint of the last uploaded content, so unchanged data isn't sent again. */
  lastContentKey: string | null;
  status: SyncStatus;
  error: string | null;
  update: (patch: Partial<Omit<SyncState, 'update' | 'reset'>>) => void;
  reset: () => void;
}

const initial = {
  enabled: false,
  accountId: null,
  revision: 0,
  lastSyncedAt: null,
  lastContentKey: null,
  status: 'idle' as SyncStatus,
  error: null,
};

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      ...initial,
      update: (patch) => set(patch),
      reset: () => set(initial),
    }),
    {
      name: 'bg-coach/sync',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<SyncState, typeof initial>(initial),
      partialize: ({ enabled, accountId, revision, lastSyncedAt, lastContentKey }) => ({
        enabled,
        accountId,
        revision,
        lastSyncedAt,
        lastContentKey,
      }),
    },
  ),
);
