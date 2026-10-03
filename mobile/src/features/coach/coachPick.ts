import type { IconName } from '@/components/ui/Icon';
import type { SkillCategory } from '@/curriculum';
import type { DrillCategory } from '@/curriculum/drills';
import type { LessonRecords } from '@/features/learning/progression';
import type { CategoryStats } from '@/features/learning/progressModel';
import { isMastered, type UserMistake } from '@/features/practice/mistakes';
import { focusSkill, skillRows } from '@/features/profile/profileStats';
import { categoryLabel, type MistakeCategory } from '@/game';

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

export interface CoachInput {
  mistakes: UserMistake[];
  byCategory: Partial<Record<SkillCategory, CategoryStats>>;
  lessons: LessonRecords;
  unlockedDrills: DrillCategory[];
  canPracticeMistakes: boolean;
  canAccessLesson: (lessonId: string) => boolean;
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

export function coachPick(input: CoachInput): CoachPick | null {
  // 1. A pattern in your games.
  const open = input.mistakes.filter((mistake) => !isMastered(mistake));
  const counts = new Map<MistakeCategory, number>();
  for (const mistake of open) counts.set(mistake.category, (counts.get(mistake.category) ?? 0) + 1);
  const [worst] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (worst && worst[1] >= PATTERN_THRESHOLD) {
    const [category, count] = worst;
    const topic = categoryLabel(category);
    const reason = `${count} of the moves the coach flagged in your games were about ${topic.toLowerCase()}.`;
    if (input.canPracticeMistakes) {
      return {
        topic,
        reason,
        action: { kind: 'mistakes' },
        actionLabel: 'Practise those positions',
        icon: FOR_MISTAKE[category].icon,
        premium: true,
      };
    }
    const training = train(FOR_MISTAKE[category], input);
    if (training) return { topic, reason, ...training, icon: FOR_MISTAKE[category].icon, premium: false };
  }

  // 2. Your weakest skill in lessons.
  const weakest = focusSkill(skillRows(input.byCategory));
  if (weakest) {
    const training = train({ drill: weakest.drill, lessonId: LESSON_FOR_SKILL[weakest.id] }, input);
    if (training) {
      return {
        topic: weakest.label,
        reason: `You get ${Math.round(weakest.accuracy * 100)}% of ${weakest.label.toLowerCase()} exercises right on the first try, your lowest score.`,
        ...training,
        icon: weakest.icon,
        premium: false,
      };
    }
  }
  return null;
}
