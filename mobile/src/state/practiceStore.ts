import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DrillCategory } from '@/curriculum/drills';
import type { LevelStats } from '@/features/practice/drillLevels';

import { isPlainObject, keepEntries, mergeChecked } from './sanitize';
import { persistStorage } from './storage';

/** Drills, your own mistakes, or single positions ("What would you play?"). */
export type PracticeKind = DrillCategory | 'mistakes' | 'position';

export interface PracticeRecord {
  sessions: number;
  /** Most exercises solved on the first try in one session. */
  bestFirstTry: number;
  lastPlayedAt: string | null;
  /** Answers per drill level: how the drill knows when to move up. Older saves lack it. */
  levels?: Partial<Record<string, LevelStats>>;
}

/** One answer in a drill session, filed under its level. */
export interface LevelResult {
  level: string;
  firstTry: boolean;
}

export function addLevelResults(
  levels: Partial<Record<string, LevelStats>> = {},
  results: readonly LevelResult[],
): Partial<Record<string, LevelStats>> {
  const next = { ...levels };
  for (const { level, firstTry } of results) {
    const current = next[level] ?? { attempted: 0, firstTry: 0 };
    next[level] = { attempted: current.attempted + 1, firstTry: current.firstTry + (firstTry ? 1 : 0) };
  }
  return next;
}

const isLevelStats = (value: unknown): value is LevelStats =>
  isPlainObject(value) && typeof value.attempted === 'number' && typeof value.firstTry === 'number';

interface PracticeState {
  records: Partial<Record<PracticeKind, PracticeRecord>>;
  recordSession: (kind: PracticeKind, firstTry: number, now?: string, levelResults?: LevelResult[]) => void;
  reset: () => void;
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set, get) => ({
      records: {},
      recordSession: (kind, firstTry, now = new Date().toISOString(), levelResults = []) => {
        const previous = get().records[kind] ?? { sessions: 0, bestFirstTry: 0, lastPlayedAt: null };
        const levels = levelResults.length > 0 ? addLevelResults(previous.levels, levelResults) : previous.levels;
        set({
          records: {
            ...get().records,
            [kind]: {
              sessions: previous.sessions + 1,
              bestFirstTry: Math.max(previous.bestFirstTry, firstTry),
              lastPlayedAt: now,
              ...(levels ? { levels } : {}),
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
      merge: mergeChecked<PracticeState, Pick<PracticeState, 'records'>>({ records: {} }, (saved) => ({
        records: Object.fromEntries(
          Object.entries(keepEntries<PracticeRecord>(saved.records, isPlainObject)).map(([kind, record]) => [
            kind,
            isPlainObject(record.levels)
              ? { ...record, levels: keepEntries<LevelStats>(record.levels, isLevelStats) }
              : { ...record, levels: undefined },
          ]),
        ),
      })),
      partialize: ({ records }) => ({ records }),
    },
  ),
);
