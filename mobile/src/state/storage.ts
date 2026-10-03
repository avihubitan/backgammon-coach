import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { crashReporter } from '@/services/crash';

/** The part of AsyncStorage the stores use (lets tests pass a fake). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const report = (error: unknown, store: string, phase: 'read' | 'write') =>
  crashReporter.captureException(error, { store, phase });

/** Reads and parses one key; a value that can't be read or parsed counts as missing (and is reported). */
async function readJson<T>(backend: KeyValueStorage, key: string): Promise<T | null> {
  try {
    const raw = await backend.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (error) {
    report(error, key, 'read');
    return null;
  }
}

async function writeJson(backend: KeyValueStorage, key: string, value: unknown): Promise<void> {
  try {
    await backend.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Out of space, or the storage refused: keep playing; the next change tries again.
    report(error, key, 'write');
  }
}

/**
 * JSON storage for the persisted stores. A save that can't be read (cut short
 * by a crash, or too large to load, as Android refuses values over about 2 MB)
 * starts that store fresh instead of stopping the app at start-up.
 */
export function createSafeStorage<S>(backend: KeyValueStorage = AsyncStorage): PersistStorage<S, Promise<void>> {
  return {
    getItem: (name) => readJson<StorageValue<S>>(backend, name),
    setItem: (name, value) => writeJson(backend, name, value),
    removeItem: async (name) => {
      try {
        await backend.removeItem(name);
      } catch (error) {
        report(error, name, 'write');
      }
    },
  };
}

/** Shared by the stores, whatever their shape. */
export const persistStorage: PersistStorage<any, Promise<void>> = createSafeStorage();

/** Largest JSON (in characters) written for the finished games, well under Android's 2 MB limit. */
export const FINISHED_GAMES_BUDGET = 1_200_000;
/** Games always kept, whatever their size. */
const MIN_KEPT = 5;

/** The newest games that fit the budget (the list is newest first). */
export function trimToBudget<T>(games: readonly T[], budget = FINISHED_GAMES_BUDGET): T[] {
  let kept = games.length;
  let json = JSON.stringify(games);
  while (json.length > budget && kept > MIN_KEPT) {
    kept = Math.max(MIN_KEPT, Math.floor(kept * 0.8));
    json = JSON.stringify(games.slice(0, kept));
  }
  return games.slice(0, kept);
}

/**
 * Storage for the games store. Finished games (full histories and reviews, up
 * to about a megabyte) live under their own key and are written only when they
 * change; the game in progress, which changes on every move, is written on its
 * own. Before, every move rewrote everything: ~295 writes of ~875 KB in one
 * game on a heavy save. Saves from before the split load as they are.
 */
export function createGamesStorage<S extends { finished: readonly unknown[] }>(
  backend: KeyValueStorage = AsyncStorage,
  finishedKey = 'bg-coach/games-finished',
): PersistStorage<S, Promise<void>> {
  let written: readonly unknown[] | null = null;
  return {
    async getItem(name) {
      const main = await readJson<StorageValue<S>>(backend, name);
      const finished = await readJson<unknown[]>(backend, finishedKey);
      if (!main) return null;
      // Older saves kept the finished games inside the main value.
      return Array.isArray(finished) ? { ...main, state: { ...main.state, finished } } : main;
    },
    async setItem(name, value) {
      const { finished, ...rest } = value.state;
      if (finished !== written) {
        written = finished;
        await writeJson(backend, finishedKey, trimToBudget(finished));
      }
      await writeJson(backend, name, { ...value, state: rest });
    },
    async removeItem(name) {
      written = null;
      try {
        await backend.removeItem(finishedKey);
        await backend.removeItem(name);
      } catch (error) {
        report(error, name, 'write');
      }
    },
  };
}
