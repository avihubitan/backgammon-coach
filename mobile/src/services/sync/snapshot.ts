import type { GameStats } from '@/features/gameplay/gameModel';
import type { LessonRecord } from '@/features/learning/progression';
import { upgradeProgress, type ProgressData, type SkillStats } from '@/features/learning/progressModel';
import { MAX_MISTAKES, isMastered, type UserMistake } from '@/features/practice/mistakes';
import type { LevelStats } from '@/features/practice/drillLevels';
import type { PracticeKind, PracticeRecord } from '@/state/practiceStore';

/**
 * Everything worth keeping across devices, as one plain JSON document. The
 * server stores it as is; merging two copies happens here, on the device, so
 * the rules live in one place and work offline.
 */
export interface SyncSnapshot {
  schemaVersion: 1;
  /** When this copy was made (ISO). Settings such as the daily goal follow the newest copy. */
  createdAt: string;
  progress: ProgressData;
  practice: Partial<Record<PracticeKind, PracticeRecord>>;
  challenges: { completedDays: Record<string, string> };
  games: { stats: GameStats };
  mistakes: UserMistake[];
}

export const SNAPSHOT_VERSION = 1;

export function isSnapshot(value: unknown): value is SyncSnapshot {
  const candidate = value as Partial<SyncSnapshot> | null;
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    candidate.schemaVersion === SNAPSHOT_VERSION &&
    !!candidate.progress &&
    typeof candidate.progress === 'object' &&
    typeof candidate.progress.lessons === 'object'
  );
}

const maxDate = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a > b ? a : b);
const minDate = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a < b ? a : b);

function mergeLesson(a: LessonRecord | undefined, b: LessonRecord | undefined): LessonRecord {
  if (!a) return b!;
  if (!b) return a;
  return {
    completed: a.completed || b.completed,
    bestStars: Math.max(a.bestStars, b.bestStars),
    bestAccuracy: Math.max(a.bestAccuracy, b.bestAccuracy),
    // Counts can't be added without double counting the shared history: keep the larger.
    attempts: Math.max(a.attempts, b.attempts),
    completions: Math.max(a.completions, b.completions),
    firstCompletedAt: minDate(a.firstCompletedAt, b.firstCompletedAt),
    lastPlayedAt: maxDate(a.lastPlayedAt, b.lastPlayedAt),
  };
}

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, merge: (x: T | undefined, y: T | undefined) => T) {
  const out: Record<string, T> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = merge(a[key], b[key]);
  return out;
}

export function mergeProgress(first: ProgressData, second: ProgressData, newer: 'a' | 'b'): ProgressData {
  // A copy from an older app version may still count answers per lesson category.
  const a = upgradeProgress(first);
  const b = upgradeProgress(second);
  const streakSource = (a.streak.lastActiveDay ?? '') >= (b.streak.lastActiveDay ?? '') ? a.streak : b.streak;
  const bySkill = mergeRecord<SkillStats>(
    a.stats.bySkill as Record<string, SkillStats>,
    b.stats.bySkill as Record<string, SkillStats>,
    // Keep each skill's numbers together so its accuracy and recent answers stay meaningful.
    (x, y) => (!x ? y! : !y ? x : y.attempted > x.attempted ? y : x),
  );
  const attemptedSource = b.stats.exercisesAttempted > a.stats.exercisesAttempted ? b.stats : a.stats;
  return {
    version: 2,
    onboardingCompleted: a.onboardingCompleted || b.onboardingCompleted,
    lessons: mergeRecord(a.lessons, b.lessons, mergeLesson),
    // XP earned on two devices while offline can't be told apart from shared XP: keep the larger total.
    xp: Math.max(a.xp, b.xp),
    xpByDay: mergeRecord(a.xpByDay, b.xpByDay, (x, y) => Math.max(x ?? 0, y ?? 0)),
    streak: { ...streakSource, longest: Math.max(a.streak.longest, b.streak.longest) },
    dailyGoalXp: newer === 'a' ? a.dailyGoalXp : b.dailyGoalXp,
    stats: {
      exercisesAttempted: attemptedSource.exercisesAttempted,
      exercisesFirstTry: attemptedSource.exercisesFirstTry,
      bySkill,
      timeLearningMs: Math.max(a.stats.timeLearningMs, b.stats.timeLearningMs),
      practiceSessions: Math.max(a.stats.practiceSessions, b.stats.practiceSessions),
    },
    achievements: mergeRecord(a.achievements, b.achievements, (x, y) => minDate(x ?? null, y ?? null)!),
  };
}

function mergePractice(
  a: SyncSnapshot['practice'],
  b: SyncSnapshot['practice'],
): SyncSnapshot['practice'] {
  return mergeRecord<PracticeRecord>(
    a as Record<string, PracticeRecord>,
    b as Record<string, PracticeRecord>,
    (x, y) =>
      !x
        ? y!
        : !y
          ? x
          : {
              sessions: Math.max(x.sessions, y.sessions),
              bestFirstTry: Math.max(x.bestFirstTry, y.bestFirstTry),
              lastPlayedAt: maxDate(x.lastPlayedAt, y.lastPlayedAt),
              // Each level keeps the copy with more answers, so its accuracy stays whole.
              ...(x.levels || y.levels
                ? {
                    levels: mergeRecord<LevelStats>(
                      (x.levels ?? {}) as Record<string, LevelStats>,
                      (y.levels ?? {}) as Record<string, LevelStats>,
                      (a, b) => (!a ? b! : !b ? a : b.attempted > a.attempted ? b : a),
                    ),
                  }
                : {}),
            },
  ) as SyncSnapshot['practice'];
}

/** One mistake practised on two devices: counts keep the larger, the schedule follows the latest practice. */
function mergeMistake(x: UserMistake, y: UserMistake): UserMistake {
  const latest = (y.lastPracticedAt ?? '') > (x.lastPracticedAt ?? '') ? y : x;
  const merged: UserMistake = {
    ...x,
    attempts: Math.max(x.attempts, y.attempts),
    solved: Math.max(x.solved, y.solved),
    lastPracticedAt: maxDate(x.lastPracticedAt, y.lastPracticedAt),
  };
  if (x.wrong !== undefined || y.wrong !== undefined) merged.wrong = Math.max(x.wrong ?? 0, y.wrong ?? 0);
  for (const key of ['streak', 'dueDay', 'lastCorrectDay'] as const) {
    if (latest[key] !== undefined) (merged as unknown as Record<string, unknown>)[key] = latest[key];
  }
  return merged;
}

function mergeMistakeLists(a: UserMistake[], b: UserMistake[]): UserMistake[] {
  const byId = new Map<string, UserMistake>();
  for (const mistake of [...a, ...b]) {
    const known = byId.get(mistake.id);
    byId.set(
      mistake.id,
      !known
        ? mistake
        : mergeMistake(known, mistake),
    );
  }
  const merged = Array.from(byId.values()).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  if (merged.length <= MAX_MISTAKES) return merged;
  // Same rule as the mistake store: keep unmastered and costly ones.
  return merged
    .sort((x, y) => Number(isMastered(x)) - Number(isMastered(y)) || y.severity - x.severity)
    .slice(0, MAX_MISTAKES);
}

/** Combines two copies of the player's data without losing anything either one learned. */
export function mergeSnapshots(a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot {
  const newer = b.createdAt > a.createdAt ? 'b' : 'a';
  return {
    schemaVersion: 1,
    createdAt: newer === 'a' ? a.createdAt : b.createdAt,
    progress: mergeProgress(a.progress, b.progress, newer),
    practice: mergePractice(a.practice, b.practice),
    challenges: { completedDays: { ...b.challenges.completedDays, ...a.challenges.completedDays } },
    games: { stats: b.games.stats.gamesPlayed > a.games.stats.gamesPlayed ? b.games.stats : a.games.stats },
    mistakes: mergeMistakeLists(a.mistakes, b.mistakes),
  };
}

/** A stable fingerprint of the content (not its timestamp), to skip uploads that change nothing. */
export function contentKey(snapshot: SyncSnapshot): string {
  const { createdAt: _createdAt, ...content } = snapshot;
  return stableStringify(content);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
