import { allLessons, introducingLesson, lessonsForSkill, lessonSkills, SKILLS, type Lesson, type SkillId } from '@/curriculum';
import { dayKey, type LessonRecords } from '@/features/learning/progression';
import type { UserMistake } from '@/features/practice/mistakes';
import type { GameReview } from '@/game';

import { skillOfMistake } from './extract';

/**
 * Connects what happens in a game to the curriculum: the lesson behind a
 * mistake (one the learner has done, or the one ahead of them that teaches
 * it), and how often that idea tripped them up today. Pure: the result
 * sheet, Coach Watch and the review only render it.
 */

/** The lesson that teaches `skill` to someone who hasn't studied it yet: where it's introduced (always free). */
export function teachingLesson(skill: SkillId): Lesson | null {
  return introducingLesson(skill) ?? lessonsForSkill(skill)[0] ?? null;
}

/** The lesson the learner finished that teaches `skill` (its main skill first, the most recent of those). */
export function practisedIn(skill: SkillId, lessons: LessonRecords): Lesson | null {
  const done = allLessons.filter((lesson) => lessons[lesson.id]?.completed);
  const main = done.filter((lesson) => lesson.skill === skill);
  if (main.length > 0) return main[main.length - 1];
  return done.filter((lesson) => lessonSkills(lesson).includes(skill)).pop() ?? null;
}

export interface GameLesson {
  skill: SkillId;
  /** Mistakes about it in this game. */
  inGame: number;
  /** Mistakes about it in every game today, this one included. */
  today: number;
  /** The lesson where the learner studied it, or the one ahead on their path that teaches it. */
  lesson: Lesson;
  /** Whether the learner has done `lesson`. */
  studied: boolean;
  /** The first such position in this game: the one to practise. */
  mistakeId: string;
}

/** The skills behind a game's clear mistakes, most mistakes first (then the earliest): with each one's count and first move. */
function mistakeSkills(review: GameReview, withCube: boolean): [SkillId, { count: number; first: number }][] {
  const bySkill = new Map<SkillId, { count: number; first: number }>();
  const add = (skill: SkillId, index: number) => {
    const known = bySkill.get(skill);
    bySkill.set(skill, { count: (known?.count ?? 0) + 1, first: Math.min(known?.first ?? index, index) });
  };
  for (const move of review.moves) {
    if (move.severity === 'mistake' || move.severity === 'blunder') add(skillOfMistake(move), move.index);
  }
  if (withCube) for (const decision of review.cube) if (!decision.correct) add('cube', decision.index);
  return [...bySkill.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
}

/** The skill behind most of a game's clear mistakes (a wrong cube decision counts for the cube), for "Area to improve". */
export function reviewFocus(review: GameReview): SkillId | null {
  return mistakeSkills(review, true)[0]?.[0] ?? null;
}

/**
 * The idea this game most needs: the skill behind most of its clear mistakes
 * (on a tie, one the learner has studied), with the lesson that taught it or
 * the one ahead that will. Null when the game had no clear mistakes.
 */
export function gameLesson(
  gameId: string,
  review: GameReview,
  lessons: LessonRecords,
  mistakes: readonly UserMistake[],
  today: string,
  /** Games played today: a mistake counts for today when its game does (else when it was saved). */
  playedToday?: ReadonlySet<string>,
): GameLesson | null {
  const fromToday = (mistake: UserMistake) => {
    if (playedToday) return playedToday.has(mistake.gameId);
    const made = new Date(mistake.createdAt);
    return !Number.isNaN(made.getTime()) && dayKey(made) === today;
  };
  // Checker moves only: they're the positions there are to practise.
  const ranked = mistakeSkills(review, false)
    .map(([skill, stats]) => ({ skill, ...stats, done: practisedIn(skill, lessons), ahead: teachingLesson(skill) }))
    .filter((entry) => entry.done || entry.ahead)
    .sort((a, b) => b.count - a.count || Number(!!b.done) - Number(!!a.done) || a.first - b.first);
  const top = ranked[0];
  if (!top) return null;
  const todayCount = mistakes.filter((mistake) => fromToday(mistake) && skillOfMistake(mistake) === top.skill).length;
  return {
    skill: top.skill,
    inGame: top.count,
    today: Math.max(todayCount, top.count),
    lesson: (top.done ?? top.ahead)!,
    studied: !!top.done,
    mistakeId: `${gameId}:${top.first}`,
  };
}

const times = (count: number) => (count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`);

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "You practised playing safe in “Safe or Risky?”. It tripped you up twice today."
 * Not studied yet: "Making points tripped you up twice this game. “Making Points”, ahead on your path, teaches it."
 */
export function gameLessonText(note: GameLesson): string {
  const when = note.today > note.inGame ? `${times(note.today)} today` : `${times(note.inGame)} this game`;
  const { doing } = SKILLS[note.skill];
  return note.studied
    ? `You practised ${doing} in “${note.lesson.title}”. It tripped you up ${when}.`
    : `${capitalised(doing)} tripped you up ${when}. “${note.lesson.title}”, ahead on your path, teaches it.`;
}

/** For Coach Watch and reviews: "You practised this in “Making Points”." or "You’ll learn this in “Making Points”." */
export function practisedLine(skill: SkillId, lessons: LessonRecords): string | null {
  const done = practisedIn(skill, lessons);
  if (done) return `You practised this in “${done.title}”.`;
  const ahead = teachingLesson(skill);
  return ahead ? `You’ll learn this in “${ahead.title}”.` : null;
}
