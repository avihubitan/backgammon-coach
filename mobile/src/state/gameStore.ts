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

import { isPlainObject, mergeChecked } from './sanitize';
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
  /** Counts a coach hint against this game. */
  countHint: () => void;
  abandonGame: () => void;
  saveReview: (gameId: string, review: FinishedGame['review']) => void;
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

      countHint: () => {
        const active = get().active;
        if (active) set({ active: { ...active, hintsUsed: (active.hintsUsed ?? 0) + 1 } });
      },

      abandonGame: () => set({ active: null }),

      saveReview: (gameId, review) =>
        set({ finished: get().finished.map((game) => (game.id === gameId ? { ...game, review } : game)) }),

      resetGames: () => set({ active: null, finished: [], stats: emptyGameStats() }),
    }),
    {
      name: 'bg-coach/games',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<GamesData & GamesActions, Pick<GamesData, 'active' | 'finished' | 'stats' | 'lastSettings'>>(
        { active: null, finished: [], stats: emptyGameStats(), lastSettings: DEFAULT_SETTINGS },
        (saved) => ({
          ...saved,
          active:
            isPlainObject(saved.active) && isPlainObject(saved.active.state) && isPlainObject(saved.active.settings)
              ? saved.active
              : null,
          finished: saved.finished.filter(
            (game) => isPlainObject(game) && typeof game.id === 'string' && Array.isArray(game.history),
          ),
        }),
      ),
      partialize: ({ active, finished, stats, lastSettings }) => ({ active, finished, stats, lastSettings }),
    },
  ),
);
