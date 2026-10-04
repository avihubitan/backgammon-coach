import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  mergeMistakes,
  mistakesFromReview,
  recordAttempt,
  sanitizeMistake,
  type UserMistake,
} from '@/features/practice/mistakes';
import type { GameReview } from '@/game';

import { isPlainObject, mergeChecked } from './sanitize';
import { persistStorage } from './storage';

interface MistakesState {
  mistakes: UserMistake[];
  addFromReview: (gameId: string, review: GameReview) => number;
  recordAttempt: (id: string, correct: boolean) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useMistakesStore = create<MistakesState>()(
  persist(
    (set, get) => ({
      mistakes: [],
      addFromReview: (gameId, review) => {
        const incoming = mistakesFromReview(gameId, review, new Date().toISOString());
        const before = get().mistakes.length;
        const merged = mergeMistakes(get().mistakes, incoming);
        set({ mistakes: merged });
        return merged.length - before;
      },
      recordAttempt: (id, correct) =>
        set({
          mistakes: get().mistakes.map((mistake) =>
            mistake.id === id ? recordAttempt(mistake, correct, new Date().toISOString()) : mistake,
          ),
        }),
      remove: (id) => set({ mistakes: get().mistakes.filter((mistake) => mistake.id !== id) }),
      reset: () => set({ mistakes: [] }),
    }),
    {
      name: 'bg-coach/mistakes',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<MistakesState, Pick<MistakesState, 'mistakes'>>({ mistakes: [] }, (saved) => ({
        mistakes: saved.mistakes
          .filter((mistake) => isPlainObject(mistake) && typeof mistake.id === 'string' && isPlainObject(mistake.position))
          .map(sanitizeMistake),
      })),
      partialize: ({ mistakes }) => ({ mistakes }),
    },
  ),
);
