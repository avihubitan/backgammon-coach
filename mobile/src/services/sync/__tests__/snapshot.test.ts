import { emptyGameStats } from '@/features/gameplay/gameModel';
import { emptyLessonRecord } from '@/features/learning/progression';
import { initialProgress } from '@/features/learning/progressModel';
import type { UserMistake } from '@/features/practice/mistakes';

import { contentKey, isSnapshot, mergeSnapshots, type SyncSnapshot } from '../snapshot';

const base = (overrides: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  schemaVersion: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  progress: initialProgress(),
  practice: {},
  challenges: { completedDays: {} },
  games: { stats: emptyGameStats() },
  mistakes: [],
  ...overrides,
});

const lesson = (patch: Partial<ReturnType<typeof emptyLessonRecord>>) => ({ ...emptyLessonRecord(), ...patch });
const mistake = (id: string, patch: Partial<UserMistake> = {}) =>
  ({ id, createdAt: '2026-10-01T00:00:00Z', attempts: 0, solved: 0, lastPracticedAt: null, severity: 0.1, ...patch }) as UserMistake;

describe('merging snapshots', () => {
  it('keeps every lesson either device finished, with the best results', () => {
    const a = base({
      progress: {
        ...initialProgress(),
        lessons: {
          'board-1': lesson({ completed: true, bestStars: 2, attempts: 3, firstCompletedAt: '2026-09-01', lastPlayedAt: '2026-09-05' }),
        },
      },
    });
    const b = base({
      progress: {
        ...initialProgress(),
        lessons: {
          'board-1': lesson({ completed: true, bestStars: 3, attempts: 2, firstCompletedAt: '2026-09-03', lastPlayedAt: '2026-09-09' }),
          'board-2': lesson({ completed: true, bestStars: 1 }),
        },
      },
    });
    const merged = mergeSnapshots(a, b).progress.lessons;
    expect(merged['board-1']).toMatchObject({
      completed: true,
      bestStars: 3,
      attempts: 3,
      firstCompletedAt: '2026-09-01',
      lastPlayedAt: '2026-09-09',
    });
    expect(merged['board-2'].completed).toBe(true);
  });

  it('combines XP, days, streaks and achievements without losing any', () => {
    const a = base({
      progress: {
        ...initialProgress(),
        xp: 120,
        xpByDay: { '2026-09-30': 40, '2026-10-01': 10 },
        streak: { current: 3, longest: 5, lastActiveDay: '2026-10-01' },
        achievements: { 'first-steps': '2026-09-02' },
      },
    });
    const b = base({
      progress: {
        ...initialProgress(),
        xp: 90,
        xpByDay: { '2026-10-01': 30, '2026-10-02': 20 },
        streak: { current: 1, longest: 8, lastActiveDay: '2026-10-02' },
        achievements: { 'first-steps': '2026-09-01', century: '2026-09-20' },
      },
    });
    const merged = mergeSnapshots(a, b).progress;
    expect(merged.xp).toBe(120);
    expect(merged.xpByDay).toEqual({ '2026-09-30': 40, '2026-10-01': 30, '2026-10-02': 20 });
    expect(merged.streak).toEqual({ current: 1, longest: 8, lastActiveDay: '2026-10-02' });
    expect(merged.achievements).toEqual({ 'first-steps': '2026-09-01', century: '2026-09-20' });
  });

  it('keeps the streak freezes that belong to the streak it keeps', () => {
    const spent = base({
      progress: { ...initialProgress(), streak: { current: 12, longest: 12, lastActiveDay: '2026-10-03', freezes: 0 } },
    });
    const stale = base({
      progress: { ...initialProgress(), streak: { current: 10, longest: 10, lastActiveDay: '2026-10-01', freezes: 1 } },
    });
    expect(mergeSnapshots(stale, spent).progress.streak).toEqual({ current: 12, longest: 12, lastActiveDay: '2026-10-03', freezes: 0 });
    expect(mergeSnapshots(spent, stale).progress.streak.freezes).toBe(0);
  });

  it('takes settings from the newer copy and keeps skill stats consistent', () => {
    const older = base({
      createdAt: '2026-10-01T10:00:00.000Z',
      progress: {
        ...initialProgress(),
        dailyGoalXp: 30,
        stats: { ...initialProgress().stats, byCategory: { hitting: { attempted: 10, firstTry: 9 } } },
      },
    });
    const newer = base({
      createdAt: '2026-10-02T10:00:00.000Z',
      progress: {
        ...initialProgress(),
        dailyGoalXp: 50,
        stats: { ...initialProgress().stats, byCategory: { hitting: { attempted: 4, firstTry: 1 } } },
      },
    });
    const merged = mergeSnapshots(older, newer);
    expect(merged.progress.dailyGoalXp).toBe(50);
    expect(merged.progress.stats.byCategory.hitting).toEqual({ attempted: 10, firstTry: 9 });
    expect(merged.createdAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('unions practice, challenge days and mistakes', () => {
    const a = base({
      practice: { hitting: { sessions: 2, bestFirstTry: 4, lastPlayedAt: '2026-09-30T00:00:00Z' } },
      challenges: { completedDays: { '2026-09-30': 'hit-3' } },
      mistakes: [mistake('m1', { solved: 1 }), mistake('m2')],
      games: { stats: { ...emptyGameStats(), gamesPlayed: 3 } },
    });
    const b = base({
      practice: {
        hitting: { sessions: 1, bestFirstTry: 5, lastPlayedAt: '2026-10-01T00:00:00Z' },
        race: { sessions: 1, bestFirstTry: 2, lastPlayedAt: null },
      },
      challenges: { completedDays: { '2026-10-01': 'lesson-1' } },
      mistakes: [mistake('m1', { solved: 2, attempts: 3 }), mistake('m3')],
      games: { stats: { ...emptyGameStats(), gamesPlayed: 5 } },
    });
    const merged = mergeSnapshots(a, b);
    expect(merged.practice.hitting).toEqual({ sessions: 2, bestFirstTry: 5, lastPlayedAt: '2026-10-01T00:00:00Z' });
    expect(merged.practice.race?.sessions).toBe(1);
    expect(Object.keys(merged.challenges.completedDays).sort()).toEqual(['2026-09-30', '2026-10-01']);
    expect(merged.mistakes.map((m) => m.id).sort()).toEqual(['m1', 'm2', 'm3']);
    expect(merged.mistakes.find((m) => m.id === 'm1')).toMatchObject({ solved: 2, attempts: 3 });
    expect(merged.games.stats.gamesPlayed).toBe(5);
  });

  it('is idempotent: merging a copy with itself changes nothing', () => {
    const a = base({ progress: { ...initialProgress(), xp: 10, lessons: { 'board-1': lesson({ completed: true }) } } });
    expect(contentKey(mergeSnapshots(a, a))).toBe(contentKey(a));
  });

  it('recognises snapshots it can merge', () => {
    expect(isSnapshot(base())).toBe(true);
    expect(isSnapshot({ schemaVersion: 2, progress: { lessons: {} } })).toBe(false);
    expect(isSnapshot(null)).toBe(false);
  });

  it('fingerprints content, not the time it was taken', () => {
    expect(contentKey(base({ createdAt: 'x' }))).toBe(contentKey(base({ createdAt: 'y' })));
    expect(contentKey(base())).not.toBe(contentKey(base({ progress: { ...initialProgress(), xp: 1 } })));
  });
});
