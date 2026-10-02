import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  applyResultToMatch,
  emptyGameStats,
  MAX_HISTORY,
  nextGameInMatch,
  recordGameStats,
  startActiveGame,
  type ActiveGame,
  type FinishedGame,
  type GameSettings,
  type GameStats,
} from '@/features/gameplay/gameModel';
import type { GameState } from '@/game';
import { newId } from '@/utils/id';

import { persistStorage } from './storage';

interface GamesData {
  active: ActiveGame | null;
  finished: FinishedGame[];
  stats: GameStats;
  lastSettings: GameSettings;
}

interface GamesActions {
  startGame: (settings: GameSettings) => ActiveGame;
  /** Replaces the active game's state (every reducer step goes through here so it persists). */
  updateState: (state: GameState, extra?: Partial<Pick<ActiveGame, 'openingRoll'>>) => void;
  /** Records the finished game; returns whether the match is over. */
  finishGame: () => { finished: FinishedGame; matchOver: boolean } | null;
  continueMatch: () => void;
  abandonGame: () => void;
  resetGames: () => void;
}

const DEFAULT_SETTINGS: GameSettings = { level: 'beginner', cubeEnabled: false, matchLength: 1 };

export const useGameStore = create<GamesData & GamesActions>()(
  persist(
    (set, get) => ({
      active: null,
      finished: [],
      stats: emptyGameStats(),
      lastSettings: DEFAULT_SETTINGS,

      startGame: (settings) => {
        const active = startActiveGame(newId(), settings, new Date().toISOString());
        set({ active, lastSettings: settings });
        return active;
      },

      updateState: (state, extra = {}) => {
        const active = get().active;
        if (!active) return;
        set({ active: { ...active, ...extra, state } });
      },

      finishGame: () => {
        const active = get().active;
        const result = active?.state.result;
        if (!active || !result) return null;
        const finished: FinishedGame = {
          id: `${active.id}-${active.gameNumber}`,
          level: active.settings.level,
          startedAt: active.startedAt,
          finishedAt: new Date().toISOString(),
          result,
          playerWon: result.winner === 'player1',
          history: active.state.history,
          matchLength: active.settings.matchLength,
        };
        const { match, matchOver } = applyResultToMatch(active, result);
        set({
          finished: [finished, ...get().finished].slice(0, MAX_HISTORY),
          stats: recordGameStats(get().stats, active.settings.level, result),
          active: { ...active, match },
        });
        return { finished, matchOver };
      },

      continueMatch: () => {
        const active = get().active;
        if (active) set({ active: nextGameInMatch(active) });
      },

      abandonGame: () => set({ active: null }),

      resetGames: () => set({ active: null, finished: [], stats: emptyGameStats() }),
    }),
    {
      name: 'bg-coach/games',
      version: 1,
      storage: persistStorage,
      partialize: ({ active, finished, stats, lastSettings }) => ({ active, finished, stats, lastSettings }),
    },
  ),
);
