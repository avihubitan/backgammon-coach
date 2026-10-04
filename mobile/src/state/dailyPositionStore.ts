import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { parseRef, refKey, type PositionRef } from '@/features/coach/positionOfTheDay';

import { mergeChecked } from './sanitize';
import { persistStorage } from './storage';

/**
 * Today's Position of the Day: which position it is (fixed for the day once
 * shown) and whether it's been answered. A new day starts fresh; nothing here
 * needs syncing.
 */
interface DailyPositionState {
  day: string | null;
  /** The position, as "bank:p012" or "mistake:<id>". */
  ref: string | null;
  done: boolean;
  correct: boolean | null;
  /** Positions seen today, so "Try another" doesn't repeat one. */
  seen: string[];
  /** Remembers today's position once it's been shown (see dailyPosition). */
  keep: (day: string, ref: PositionRef | null) => void;
  /** A position was answered; `daily` when it was today's Position of the Day. */
  finish: (day: string, ref: PositionRef, correct: boolean, daily: boolean) => void;
  reset: () => void;
}

const empty = { day: null, ref: null, done: false, correct: null, seen: [] as string[] };

export const useDailyPositionStore = create<DailyPositionState>()(
  persist(
    (set, get) => ({
      ...empty,
      keep: (day, ref) => {
        const state = get();
        const key = ref ? refKey(ref) : null;
        if (state.day !== day) set({ ...empty, day, ref: key });
        else if (state.ref !== key) set({ ref: key });
      },
      finish: (day, ref, correct, daily) => {
        const state = get();
        const sameDay = state.day === day;
        const key = refKey(ref);
        set({
          day,
          ref: daily ? key : sameDay ? state.ref : null,
          done: daily || (sameDay && state.done),
          correct: daily ? correct : sameDay ? state.correct : null,
          seen: [...(sameDay ? state.seen : []), key],
        });
      },
      reset: () => set(empty),
    }),
    {
      name: 'bg-coach/daily-position',
      version: 1,
      storage: persistStorage,
      merge: mergeChecked<DailyPositionState, typeof empty>(empty, (saved) => ({
        ...saved,
        seen: Array.isArray(saved.seen) ? saved.seen.filter((key) => typeof key === 'string') : [],
        correct: typeof saved.correct === 'boolean' ? saved.correct : null,
        ref: typeof saved.ref === 'string' && parseRef(saved.ref) ? saved.ref : null,
        day: typeof saved.day === 'string' ? saved.day : null,
        done: saved.done === true,
      })),
      partialize: ({ day, ref, done, correct, seen }) => ({ day, ref, done, correct, seen }),
    },
  ),
);
