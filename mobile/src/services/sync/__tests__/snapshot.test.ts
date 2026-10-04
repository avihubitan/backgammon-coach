import { emptyGameStats } from '@/features/gameplay/gameModel';
import { emptyLessonRecord } from '@/features/learning/progression';
import { emptySkillStats, initialProgress, type ProgressData } from '@/features/learning/progressModel';
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
        stats: { ...initialProgress().stats, bySkill: { hitting: { ...emptySkillStats(), attempted: 10, firstTry: 9, recent: '1101' } } },
      },
    });
    const newer = base({
      createdAt: '2026-10-02T10:00:00.000Z',
      progress: {
        ...initialProgress(),
        dailyGoalXp: 50,
        stats: { ...initialProgress().stats, bySkill: { hitting: { ...emptySkillStats(), attempted: 4, firstTry: 1, recent: '0001' } } },
      },
    });
    const merged = mergeSnapshots(older, newer);
    expect(merged.progress.dailyGoalXp).toBe(50);
    expect(merged.progress.stats.bySkill.hitting).toMatchObject({ attempted: 10, firstTry: 9, recent: '1101' });
    expect(merged.createdAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('merges a copy from an older app version that counted answers per lesson category', () => {
    const current = base({
      progress: { ...initialProgress(), stats: { ...initialProgress().stats, bySkill: { hitting: { ...emptySkillStats(), attempted: 3, firstTry: 3 } } } },
    });
    const legacyStats = { ...initialProgress().stats, bySkill: undefined, byCategory: { hitting: { attempted: 9, firstTry: 5 }, opening: { attempted: 4, firstTry: 4 } } };
    const legacy = base({ progress: { ...initialProgress(), version: 1, stats: legacyStats } as unknown as ProgressData });
    const merged = mergeSnapshots(current, legacy);
    expect(merged.progress.version).toBe(2);
    expect(merged.progress.stats.bySkill.hitting).toMatchObject({ attempted: 9, firstTry: 5 });
    expect(merged.progress.stats.bySkill.openings).toMatchObject({ attempted: 4, firstTry: 4 });
  });

  it('keeps a mistake’s review schedule from the copy practised last', () => {
    const early = mistake('m9', { attempts: 3, solved: 2, lastPracticedAt: '2026-10-01T09:00:00Z', streak: 2, dueDay: '2026-10-04', wrong: 1 });
    const late = mistake('m9', { attempts: 4, solved: 2, lastPracticedAt: '2026-10-03T09:00:00Z', streak: 0, dueDay: '2026-10-04', wrong: 2, lastCorrectDay: '2026-10-01' });
    const merged = mergeSnapshots(base({ mistakes: [early] }), base({ mistakes: [late] })).mistakes[0];
    expect(merged).toMatchObject({ attempts: 4, solved: 2, wrong: 2, streak: 0, dueDay: '2026-10-04', lastPracticedAt: '2026-10-03T09:00:00Z' });
    // A copy from before spaced repetition doesn't wipe the schedule.
    const legacy = mistake('m9', { attempts: 1, solved: 0, lastPracticedAt: '2026-09-30T09:00:00Z' });
    expect(mergeSnapshots(base({ mistakes: [legacy] }), base({ mistakes: [early] })).mistakes[0]).toMatchObject({ streak: 2, dueDay: '2026-10-04' });
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

  it('keeps the highest skill levels, and counts today’s rounds and replays once', () => {
    const a = base({
      progress: {
        ...initialProgress(),
        skillLevels: { safety: 'reliable', hitting: 'introduced' },
        lessons: { 'board-1': lesson({ completed: true, lastPlayedAt: '2026-10-04', dayPlays: 2 }) },
      },
      practice: { hitting: { sessions: 3, bestFirstTry: 4, lastPlayedAt: '2026-10-04T09:00:00Z', dayRounds: { day: '2026-10-04', rounds: 3 } } },
    });
    const b = base({
      progress: {
        ...initialProgress(),
        skillLevels: { safety: 'practised', hitting: 'practised', points: 'introduced' },
        lessons: { 'board-1': lesson({ completed: true, lastPlayedAt: '2026-10-03', dayPlays: 6 }) },
      },
      practice: { hitting: { sessions: 2, bestFirstTry: 5, lastPlayedAt: '2026-10-03T09:00:00Z', dayRounds: { day: '2026-10-03', rounds: 5 } } },
    });
    const merged = mergeSnapshots(a, b);
    expect(merged.progress.skillLevels).toEqual({ safety: 'reliable', hitting: 'practised', points: 'introduced' });
    expect(merged.progress.lessons['board-1'].dayPlays).toBe(2);
    expect(merged.practice.hitting?.dayRounds).toEqual({ day: '2026-10-04', rounds: 3 });
    // A copy from before skill levels existed.
    const old = { ...b.progress } as Partial<typeof b.progress>;
    delete old.skillLevels;
    expect(mergeSnapshots(a, base({ progress: old as typeof b.progress })).progress.skillLevels).toEqual({
      safety: 'reliable',
      hitting: 'introduced',
    });
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
