import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DrillCategory } from '@/curriculum/drills';

import { persistStorage } from './storage';

export type PracticeKind = DrillCategory | 'mistakes';

export interface PracticeRecord {
  sessions: number;
  /** Most exercises solved on the first try in one session. */
  bestFirstTry: number;
  lastPlayedAt: string | null;
}

interface PracticeState {
  records: Partial<Record<PracticeKind, PracticeRecord>>;
  recordSession: (kind: PracticeKind, firstTry: number, now?: string) => void;
  reset: () => void;
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set, get) => ({
      records: {},
      recordSession: (kind, firstTry, now = new Date().toISOString()) => {
        const previous = get().records[kind] ?? { sessions: 0, bestFirstTry: 0, lastPlayedAt: null };
        set({
          records: {
            ...get().records,
            [kind]: {
              sessions: previous.sessions + 1,
              bestFirstTry: Math.max(previous.bestFirstTry, firstTry),
              lastPlayedAt: now,
            },
          },
        });
      },
      reset: () => set({ records: {} }),
    }),
    {
      name: 'bg-coach/practice',
      version: 1,
      storage: persistStorage,
      partialize: ({ records }) => ({ records }),
    },
  ),
);
