import { boardFromSetup, expandDice, goalMet, usesRealRoll } from '@/features/lessons/engine/evaluate';
import { createFeatureAccess } from '@/features/monetization/access';
import { FREE_ENTITLEMENTS } from '@/features/monetization/entitlements';
import {
  allCheckersHome,
  getLegalPlaysForDice,
  hasBorneOffAll,
  type BoardState,
} from '@/game';

import { ALL_MOVE_DRILLS, DRILL_CATEGORIES } from '../drills';
import {
  allLessons,
  introducingLesson,
  isScored,
  isSkillId,
  lessonIndex,
  lessonSkills,
  SKILL_GROUPS,
  SKILL_IDS,
  SKILLS,
  stepSkill,
  type ChallengeStep,
  type Lesson,
  type LessonStep,
  type MoveStep,
  type SkillId,
} from '../index';

/**
 * The curriculum quality gate, on top of curriculum.test.ts: every lesson has
 * a purpose that changes what the learner does, every skill is taught in an
 * order that makes sense, and nothing is practised before it is taught.
 */

const free = createFeatureAccess(FREE_ENTITLEMENTS, { reviewedToday: [], unlockedReviews: [] });

/** Where a skill is first taught on the path. */
const introducedAt = (skill: SkillId) => lessonIndex(introducingLesson(skill)?.id ?? '');

/** Some legal answer misses the goal: the learner can get it wrong. */
function moveIsDecision(step: MoveStep): boolean {
  const start = boardFromSetup(step.board);
  const plays = getLegalPlaysForDice(start, 'player1', expandDice(step.board.dice), { largerDieRule: usesRealRoll(step) });
  return plays.some((play) => !goalMet(step.goal, start, play.board, play.moves));
}

function challengeIsDecision(step: ChallengeStep): boolean {
  const reached = (board: BoardState) =>
    step.goal.type === 'bear-off-all' ? hasBorneOffAll(board, 'player1') : allCheckersHome(board, 'player1');
  // Some sequence of legal plays ends without reaching the goal.
  const canFail = (board: BoardState, roll: number): boolean => {
    if (reached(board)) return false;
    if (roll >= step.rolls.length) return true;
    return getLegalPlaysForDice(board, 'player1', expandDice(step.rolls[roll])).some((play) => canFail(play.board, roll + 1));
  };
  return canFail(boardFromSetup(step.board), 0);
}

function isRealDecision(step: LessonStep): boolean {
  switch (step.kind) {
    case 'move':
      return moveIsDecision(step);
    case 'challenge':
      return challengeIsDecision(step);
    case 'choice':
      return step.options.length >= 2;
    case 'tap':
    case 'cube':
      return true;
    default:
      return false;
  }
}

describe('skill taxonomy', () => {
  it('puts every skill in exactly one group', () => {
    const grouped = SKILL_GROUPS.flatMap((group) => group.skills);
    expect([...grouped].sort()).toEqual([...SKILL_IDS].sort());
    for (const group of SKILL_GROUPS) for (const skill of group.skills) expect(SKILLS[skill].group).toBe(group.id);
  });

  it('only names skills that exist as prerequisites', () => {
    for (const skill of SKILL_IDS) for (const required of SKILLS[skill].requires) expect(isSkillId(required)).toBe(true);
  });

  it.each(SKILL_IDS.map((skill) => [skill]))('teaches %s in a lesson every player can open', (skill) => {
    const lesson = introducingLesson(skill);
    expect(lesson).toBeDefined();
    expect(free.canAccessLesson(lesson!.id)).toBe(true);
  });

  it.each(SKILL_IDS.map((skill) => [skill]))('teaches what %s builds on first', (skill) => {
    for (const required of SKILLS[skill].requires) {
      expect(introducedAt(required)).toBeLessThanOrEqual(introducedAt(skill));
    }
  });
});

describe.each(allLessons.map((lesson) => [lesson.id, lesson] as [string, Lesson]))('lesson %s', (_id, lesson) => {
  const index = lessonIndex(lesson.id);
  const scored = lesson.steps.filter(isScored);
  const stepAt = (id: string) => lesson.steps.findIndex((step) => step.id === id);

  it('trains known skills, and measures each one', () => {
    const skills = lessonSkills(lesson);
    expect(skills.every(isSkillId)).toBe(true);
    expect(new Set(skills).size).toBe(skills.length);
    for (const step of lesson.steps) if (step.skill) expect(skills).toContain(step.skill);
    // Every skill it claims gets at least one scored answer.
    for (const skill of skills) expect(scored.some((step) => stepSkill(lesson, step) === skill)).toBe(true);
  });

  it('states an outcome and where it shows up in a game', () => {
    expect(lesson.purpose.outcome.length).toBeGreaterThan(10);
    expect(lesson.purpose.outcome.length).toBeLessThanOrEqual(110);
    expect(lesson.purpose.inGame.length).toBeGreaterThan(10);
    expect(lesson.purpose.inGame.length).toBeLessThanOrEqual(120);
  });

  it('builds only on skills taught earlier', () => {
    for (const required of lesson.purpose.requires) {
      expect(isSkillId(required)).toBe(true);
      expect(introducedAt(required)).toBeLessThan(index);
    }
  });

  it('shows the idea on the board, then asks for a real decision', () => {
    const shows = stepAt(lesson.purpose.shows);
    const decision = stepAt(lesson.purpose.decision);
    expect(shows).toBeGreaterThanOrEqual(0);
    expect(decision).toBeGreaterThan(shows);
    const demo = lesson.steps[shows];
    expect('board' in demo && !!demo.board).toBe(true);
    const step = lesson.steps[decision];
    expect(isScored(step)).toBe(true);
    expect(isRealDecision(step)).toBe(true);
  });

  it('asks before it explains too much', () => {
    let run = 0;
    for (const step of lesson.steps) {
      run = isScored(step) ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(2);
    }
    expect(scored.length).toBeGreaterThanOrEqual(2);
  });

  it('gives feedback on every answer', () => {
    for (const step of scored) {
      switch (step.kind) {
        case 'move':
          expect(step.correct.length).toBeGreaterThan(0);
          expect(step.wrong.length > 0 || !!step.coachFeedback).toBe(true);
          break;
        case 'tap':
          expect(step.correct.length).toBeGreaterThan(0);
          expect(step.wrong.length).toBeGreaterThan(0);
          break;
        case 'challenge':
          expect(step.success.length).toBeGreaterThan(0);
          expect(step.failure.length).toBeGreaterThan(0);
          break;
        default:
          break;
      }
    }
  });
});

describe('the gate itself', () => {
  it('does not count a move with only one legal play as a decision', () => {
    const lesson = allLessons.find((candidate) => candidate.id === 'board-5')!;
    const forced = lesson.steps.find((step) => step.id === 'move-6')!;
    expect(isRealDecision(forced)).toBe(false);
    expect(isRealDecision(lesson.steps.find((step) => step.id === 'count-5')!)).toBe(true);
  });
});

describe('practice never comes before its lesson', () => {
  it.each(DRILL_CATEGORIES.map((info) => [info.id, info] as const))('the %s drills', (_id, info) => {
    const unlock = lessonIndex(info.requiresLesson);
    expect(unlock).toBeGreaterThanOrEqual(0);
    expect(introducedAt(info.skill)).toBeLessThanOrEqual(unlock);
    for (const skill of info.alsoTrains ?? []) expect(isSkillId(skill)).toBe(true);
  });

  it.each(ALL_MOVE_DRILLS.map((drill) => [drill.id, drill] as const))('drill %s', (_id, drill) => {
    const info = DRILL_CATEGORIES.find((entry) => entry.id === drill.category)!;
    const skill = drill.skill ?? info.skill;
    const unlock = Math.max(lessonIndex(info.requiresLesson), drill.requiresLesson ? lessonIndex(drill.requiresLesson) : -1);
    expect(isSkillId(skill)).toBe(true);
    if (drill.requiresLesson) expect(lessonIndex(drill.requiresLesson)).toBeGreaterThanOrEqual(0);
    expect(introducedAt(skill)).toBeLessThanOrEqual(unlock);
  });
});
