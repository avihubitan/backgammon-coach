import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { crashReporter } from '@/services/crash';

import { useGameStore } from '../gameStore';
import { createGamesStorage, createSafeStorage, FINISHED_GAMES_BUDGET, trimToBudget, type KeyValueStorage } from '../storage';

/** An in-memory AsyncStorage that counts writes per key. */
function memoryBackend(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Record<string, number> = {};
  const backend: KeyValueStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      writes[key] = (writes[key] ?? 0) + 1;
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
  return { backend, values, writes };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.spyOn(crashReporter, 'captureException').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('safe storage', () => {
  it('treats a save cut short as missing, and reports it', async () => {
    const { backend } = memoryBackend({ 'bg-coach/progress': '{"state":{"xp":' });
    await expect(createSafeStorage(backend).getItem('bg-coach/progress')).resolves.toBeNull();
    expect(crashReporter.captureException).toHaveBeenCalledWith(expect.any(Error), { store: 'bg-coach/progress', phase: 'read' });
  });

  it('treats a value the storage refuses to read as missing (Android’s 2 MB limit)', async () => {
    const backend: KeyValueStorage = {
      ...memoryBackend().backend,
      getItem: async () => {
        throw new Error('Row too big to fit into CursorWindow');
      },
    };
    await expect(createSafeStorage(backend).getItem('bg-coach/games')).resolves.toBeNull();
  });

  it('lets a store with an unreadable save finish loading, with its defaults', async () => {
    const { backend } = memoryBackend({ broken: '{"state":' });
    const useBroken = create<{ xp: number }>()(
      persist(() => ({ xp: 0 }), { name: 'broken', storage: createSafeStorage(backend), skipHydration: true }),
    );
    await useBroken.persist.rehydrate();
    expect(useBroken.persist.hasHydrated()).toBe(true);
    expect(useBroken.getState().xp).toBe(0);
  });

  it('keeps playing when a write fails', async () => {
    const backend: KeyValueStorage = {
      ...memoryBackend().backend,
      setItem: async () => {
        throw new Error('disk full');
      },
    };
    await expect(createSafeStorage(backend).setItem('bg-coach/progress', { state: { xp: 1 } })).resolves.toBeUndefined();
    expect(crashReporter.captureException).toHaveBeenCalledWith(expect.any(Error), { store: 'bg-coach/progress', phase: 'write' });
  });
});

describe('games storage', () => {
  const game = (id: string, padding = 0) => ({ id, history: [], note: 'x'.repeat(padding) });

  it('writes finished games only when they change, not on every move', async () => {
    const { backend, writes } = memoryBackend();
    const storage = createGamesStorage<{ finished: unknown[]; active: unknown }>(backend);
    const finished = [game('a'), game('b')];
    for (let move = 0; move < 20; move++) await storage.setItem('bg-coach/games', { state: { finished, active: { move } }, version: 1 });
    expect(writes['bg-coach/games']).toBe(20);
    expect(writes['bg-coach/games-finished']).toBe(1);
    await storage.setItem('bg-coach/games', { state: { finished: [game('c'), ...finished], active: null }, version: 1 });
    expect(writes['bg-coach/games-finished']).toBe(2);
  });

  it('reads both parts back together, and saves from before the split as they are', async () => {
    const split = memoryBackend({
      'bg-coach/games': JSON.stringify({ state: { active: null, stats: { gamesPlayed: 2 } }, version: 1 }),
      'bg-coach/games-finished': JSON.stringify([game('a'), game('b')]),
    });
    const read = await createGamesStorage(split.backend).getItem('bg-coach/games');
    expect(read).toMatchObject({ version: 1, state: { stats: { gamesPlayed: 2 }, finished: [{ id: 'a' }, { id: 'b' }] } });

    const legacy = memoryBackend({ 'bg-coach/games': JSON.stringify({ state: { finished: [game('old')], active: null }, version: 1 }) });
    expect(await createGamesStorage(legacy.backend).getItem('bg-coach/games')).toMatchObject({ state: { finished: [{ id: 'old' }] } });
  });

  it('keeps the finished games well under Android’s limit, dropping the oldest first', () => {
    const games = Array.from({ length: 30 }, (_, index) => game(`g${index}`, 60_000));
    const kept = trimToBudget(games);
    expect(JSON.stringify(kept).length).toBeLessThanOrEqual(FINISHED_GAMES_BUDGET);
    expect(kept[0]).toBe(games[0]);
    expect(kept.length).toBeLessThan(30);
    expect(trimToBudget(games.slice(0, 3), 10)).toHaveLength(3);
  });

  it('is what the games store uses: moves during a game don’t rewrite the finished games', async () => {
    await flush();
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    useGameStore.setState({ finished: [], active: null });
    await flush();
    setItem.mockClear();
    for (let i = 0; i < 5; i++) {
      useGameStore.setState({ lastSettings: { level: 'beginner', cubeEnabled: false, matchLength: 1 + (i % 2) } });
      await flush();
    }
    const keys = setItem.mock.calls.map(([key]) => key);
    expect(keys.filter((key) => key === 'bg-coach/games')).toHaveLength(5);
    expect(keys.filter((key) => key === 'bg-coach/games-finished')).toHaveLength(0);
  });
});
