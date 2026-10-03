import type { IconName } from '@/components/ui/Icon';
import type { SkillCategory } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import { dayKey, daysBetween, type LessonRecords } from '@/features/learning/progression';
import type { CategoryStats } from '@/features/learning/progressModel';
import { isMastered, type UserMistake } from '@/features/practice/mistakes';
import { skillRows } from '@/features/profile/profileStats';
import { categoryLabel, type MistakeCategory } from '@/game';
import type { PracticeKind } from '@/state/practiceStore';

/**
 * The coach's one suggestion for what to work on next, based on what the
 * player actually did: mistakes from their games first (that's how they
 * really play), then their weakest skill in lessons. Pure, so the rules are
 * testable; the Home card only renders the result.
 */

export type CoachAction =
  | { kind: 'mistakes' }
  | { kind: 'drill'; drill: DrillCategory }
  | { kind: 'lesson'; lessonId: string };

export interface CoachPick {
  /** What the player struggles with, in plain words. */
  topic: string;
  /** Why the coach picked it, citing the evidence. */
  reason: string;
  action: CoachAction;
  actionLabel: string;
  icon: IconName;
  /** The pick needs Premium (only ever practising your own mistakes). */
  premium: boolean;
}

interface Training {
  drill?: DrillCategory;
  lessonId: string;
  icon: IconName;
}

/** Where each kind of game mistake gets trained. Lessons here are free. */
const FOR_MISTAKE: Record<MistakeCategory, Training> = {
  opening: { drill: 'opening', lessonId: 'openings-3', icon: 'book-open-page-variant' },
  hitting: { drill: 'hitting', lessonId: 'hitting-2', icon: 'target' },
  positioning: { drill: 'points', lessonId: 'points-1', icon: 'wall' },
  running: { drill: 'safety', lessonId: 'position-2', icon: 'run-fast' },
  racing: { drill: 'race', lessonId: 'racing-1', icon: 'counter' },
  'bearing-off': { drill: 'bear-off', lessonId: 'bearoff-3', icon: 'home-export-outline' },
  cube: { lessonId: 'cube-1', icon: 'cube-outline' },
  risk: { drill: 'safety', lessonId: 'points-2', icon: 'shield-check' },
};

/** Where each lesson skill gets trained, when it has no drill of its own. */
const LESSON_FOR_SKILL: Record<SkillCategory, string> = {
  board: 'board-1',
  movement: 'moving-3',
  hitting: 'hitting-2',
  positioning: 'points-1',
  'bearing-off': 'bearoff-3',
  scoring: 'winning-1',
  opening: 'openings-3',
  strategy: 'middle-1',
  racing: 'racing-1',
  cube: 'cube-1',
};

/** Open mistakes of one kind before the coach calls it a pattern. */
export const PATTERN_THRESHOLD = 3;
/** Mistakes from games in this many days count as "recent", and recent patterns come first. */
export const RECENT_DAYS = 21;

export interface CoachInput {
  mistakes: UserMistake[];
  byCategory: Partial<Record<SkillCategory, CategoryStats>>;
  lessons: LessonRecords;
  unlockedDrills: DrillCategory[];
  canPracticeMistakes: boolean;
  canAccessLesson: (lessonId: string) => boolean;
  /** Today (YYYY-MM-DD): recent mistakes weigh more, and a pick practised today counts as done. */
  today?: string;
  /** When each kind of practice was last played (ISO timestamps). */
  practiced?: Partial<Record<PracticeKind, { lastPlayedAt: string | null }>>;
}

function train(
  training: { drill?: DrillCategory; lessonId: string },
  input: CoachInput,
): { action: CoachAction; actionLabel: string } | null {
  if (training.drill && input.unlockedDrills.includes(training.drill)) {
    return { action: { kind: 'drill', drill: training.drill }, actionLabel: 'Start the drill' };
  }
  // Only suggest lessons the player has reached and can open.
  const lessonOpen = !!input.lessons[training.lessonId]?.completed && input.canAccessLesson(training.lessonId);
  if (lessonOpen) return { action: { kind: 'lesson', lessonId: training.lessonId }, actionLabel: 'Replay the lesson' };
  return null;
}

const countByCategory = (mistakes: UserMistake[]) => {
  const counts = new Map<MistakeCategory, number>();
  for (const mistake of mistakes) counts.set(mistake.category, (counts.get(mistake.category) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= PATTERN_THRESHOLD).sort((a, b) => b[1] - a[1]);
};

/** Patterns in the player's games: recent games first, then all of them. */
function patternPicks(input: CoachInput): CoachPick[] {
  const open = input.mistakes.filter((mistake) => !isMastered(mistake));
  const today = input.today;
  const recent = today
    ? open.filter((mistake) => {
        const day = mistake.createdAt ? dayKey(new Date(mistake.createdAt)) : null;
        return !!day && daysBetween(day, today) <= RECENT_DAYS;
      })
    : [];
  let patterns = countByCategory(recent);
  let games = 'your recent games';
  if (patterns.length === 0) {
    patterns = countByCategory(open);
    games = 'your games';
  }
  return patterns.flatMap(([category, count], index): CoachPick[] => {
    const topic = categoryLabel(category);
    const reason = `${count} of the moves the coach flagged in ${games} were about ${topic.toLowerCase()}.`;
    const icon = FOR_MISTAKE[category].icon;
    // Premium practises the actual positions (one pick for all of them).
    if (input.canPracticeMistakes && index === 0) {
      return [{ topic, reason, action: { kind: 'mistakes' }, actionLabel: 'Practise those positions', icon, premium: true }];
    }
    const training = train(FOR_MISTAKE[category], input);
    return training ? [{ topic, reason, ...training, icon, premium: false }] : [];
  });
}

/** Weak skills in lessons, weakest first. */
function skillPicks(input: CoachInput): CoachPick[] {
  return skillRows(input.byCategory)
    .filter((row) => row.attempted >= 5 && row.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy)
    .flatMap((row): CoachPick[] => {
      const training = train({ drill: row.drill, lessonId: LESSON_FOR_SKILL[row.id] }, input);
      if (!training) return [];
      return [
        {
          topic: row.label,
          reason: `You get ${Math.round(row.accuracy * 100)}% of ${row.label.toLowerCase()} exercises right on the first try, your lowest score.`,
          ...training,
          icon: row.icon,
          premium: false,
        },
      ];
    });
}

const actionKey = (action: CoachAction) =>
  action.kind === 'mistakes' ? 'mistakes' : action.kind === 'drill' ? `drill:${action.drill}` : `lesson:${action.lessonId}`;

/**
 * Everything worth working on, best first: patterns in the player's games
 * (recent ones first), then weak lesson skills. One pick per topic and action.
 */
export function coachPicks(input: CoachInput): CoachPick[] {
  const seen = new Set<string>();
  return [...patternPicks(input), ...skillPicks(input)].filter((pick) => {
    const keys = [`topic:${pick.topic}`, actionKey(pick.action)];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

export function coachPick(input: CoachInput): CoachPick | null {
  return coachPicks(input)[0] ?? null;
}

/** The pick was already practised today. */
export function doneToday(action: CoachAction, input: CoachInput): boolean {
  if (!input.today) return false;
  if (action.kind === 'lesson') return input.lessons[action.lessonId]?.lastPlayedAt === input.today;
  const last = input.practiced?.[action.kind === 'mistakes' ? 'mistakes' : action.drill]?.lastPlayedAt;
  return !!last && dayKey(new Date(last)) === input.today;
}

export interface CoachPlan {
  pick: CoachPick;
  /** Practised today: the card says so, and offers what's next. */
  done: boolean;
  next: CoachPick | null;
}

/** Today's pick, whether it's done, and the next thing to work on once it is. */
export function coachPlan(input: CoachInput): CoachPlan | null {
  const picks = coachPicks(input);
  const [pick] = picks;
  if (!pick) return null;
  const done = doneToday(pick.action, input);
  return { pick, done, next: done ? (picks.slice(1).find((other) => !doneToday(other.action, input)) ?? null) : null };
}
