import type { IconName } from '@/components/ui/Icon';
import { SKILLS, type SkillId } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import { dayKey, daysBetween, type LessonRecords } from '@/features/learning/progression';
import type { SkillStats } from '@/features/learning/progressModel';
import { isMastered, type UserMistake } from '@/features/practice/mistakes';
import { skillRows } from '@/features/profile/profileStats';
import { skillOfMistake, trainingFor } from '@/features/skills/extract';
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

/** Open mistakes of one kind before the coach calls it a pattern. */
export const PATTERN_THRESHOLD = 3;
/** Mistakes from games in this many days count as "recent", and recent patterns come first. */
export const RECENT_DAYS = 21;

export interface CoachInput {
  mistakes: UserMistake[];
  bySkill: Partial<Record<SkillId, SkillStats>>;
  lessons: LessonRecords;
  unlockedDrills: DrillCategory[];
  canPracticeMistakes: boolean;
  canAccessLesson: (lessonId: string) => boolean;
  /** Today (YYYY-MM-DD): recent mistakes weigh more, and a pick practised today counts as done. */
  today?: string;
  /** When each kind of practice was last played (ISO timestamps). */
  practiced?: Partial<Record<PracticeKind, { lastPlayedAt: string | null }>>;
}

/** How to train a skill: its drill if the player has unlocked it, else a replay of a lesson they've done. */
function train(skill: SkillId, input: CoachInput): { action: CoachAction; actionLabel: string } | null {
  const { drill, lesson } = trainingFor(skill);
  if (drill && input.unlockedDrills.includes(drill)) {
    return { action: { kind: 'drill', drill }, actionLabel: 'Start the drill' };
  }
  // Only suggest lessons the player has reached and can open.
  const lessonOpen = !!lesson && !!input.lessons[lesson.id]?.completed && input.canAccessLesson(lesson.id);
  if (lesson && lessonOpen) return { action: { kind: 'lesson', lessonId: lesson.id }, actionLabel: 'Replay the lesson' };
  return null;
}

const countBySkill = (mistakes: UserMistake[]) => {
  const counts = new Map<SkillId, number>();
  for (const mistake of mistakes) {
    const skill = skillOfMistake(mistake);
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  }
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
  let patterns = countBySkill(recent);
  let games = 'your recent games';
  if (patterns.length === 0) {
    patterns = countBySkill(open);
    games = 'your games';
  }
  return patterns.flatMap(([skill, count], index): CoachPick[] => {
    const topic = SKILLS[skill].title;
    const reason = `${count} of the moves the coach flagged in ${games} were about ${topic.toLowerCase()}.`;
    const icon = SKILLS[skill].icon;
    // Premium practises the actual positions (one pick for all of them).
    if (input.canPracticeMistakes && index === 0) {
      return [{ topic, reason, action: { kind: 'mistakes' }, actionLabel: 'Practise those positions', icon, premium: true }];
    }
    const training = train(skill, input);
    return training ? [{ topic, reason, ...training, icon, premium: false }] : [];
  });
}

/** Weak skills in lessons, weakest first. */
function skillPicks(input: CoachInput): CoachPick[] {
  return skillRows(input.bySkill)
    .filter((row) => row.attempted >= 5 && row.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy)
    .flatMap((row): CoachPick[] => {
      const training = train(row.id, input);
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
