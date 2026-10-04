import { getLesson, type LessonStep } from '@/curriculum';

import {
  applyPracticeResults,
  applySkillResults,
  checkedSkillStats,
  initialProgress,
  RECENT_ANSWERS,
  skillResultsFor,
  upgradeProgress,
} from '../progressModel';

const solved = { mistakes: 0, solved: true, revealed: false };
const retried = { mistakes: 1, solved: true, revealed: false };

describe('skill statistics', () => {
  it('files each scored step under its own skill, else the lesson’s', () => {
    const lesson = getLesson('winning-2')!;
    const outcomes = Object.fromEntries(lesson.steps.map((step) => [step.id, solved]));
    const results = skillResultsFor(lesson.steps, outcomes, lesson);
    expect(results.map((result) => result.skill)).toEqual(['board', 'hitting', 'rules', 'bear-off', 'rules']);
    expect(results.every((result) => result.firstTry)).toBe(true);
  });

  it('counts only clean first tries', () => {
    const steps: LessonStep[] = [
      { id: 'a', kind: 'choice', prompt: '', options: [] },
      { id: 'b', kind: 'choice', prompt: '', options: [] },
      { id: 'c', kind: 'choice', prompt: '', options: [] },
      { id: 'd', kind: 'explain', text: '' },
    ];
    const results = skillResultsFor(steps, { a: solved, b: retried, c: { ...solved, revealed: true } }, { skill: 'pips' });
    expect(results).toEqual([
      { skill: 'pips', firstTry: true },
      { skill: 'pips', firstTry: false },
      { skill: 'pips', firstTry: false },
    ]);
  });

  it('keeps a short window of recent answers, the days practised and the last success', () => {
    let stats = applySkillResults({}, [{ skill: 'hitting', firstTry: true }, { skill: 'hitting', firstTry: false }], '2026-10-01');
    expect(stats.hitting).toEqual({
      attempted: 2,
      firstTry: 1,
      recent: '10',
      days: 1,
      lastDay: '2026-10-01',
      lastFirstTryDay: '2026-10-01',
    });
    stats = applySkillResults(stats, [{ skill: 'hitting', firstTry: false }], '2026-10-03');
    expect(stats.hitting).toMatchObject({ days: 2, lastDay: '2026-10-03', lastFirstTryDay: '2026-10-01', recent: '100' });
    const many = Array.from({ length: 20 }, (_, index) => ({ skill: 'hitting' as const, firstTry: index % 2 === 0 }));
    stats = applySkillResults(stats, many, '2026-10-03');
    expect(stats.hitting!.recent).toHaveLength(RECENT_ANSWERS);
    expect(stats.hitting!.attempted).toBe(23);
  });

  it('counts practice answers toward the skills and the totals', () => {
    const data = applyPracticeResults(initialProgress(), [{ skill: 'safety', firstTry: true }, { skill: 'safety', firstTry: false }], '2026-10-01');
    expect(data.stats.exercisesAttempted).toBe(2);
    expect(data.stats.exercisesFirstTry).toBe(1);
    expect(data.stats.bySkill.safety).toMatchObject({ attempted: 2, firstTry: 1 });
    expect(applyPracticeResults(data, [], '2026-10-01')).toBe(data);
  });
});

describe('saves from before skills', () => {
  it('moves version 1 category counts to skills, merging the ones that became one skill', () => {
    const upgraded = upgradeProgress({
      version: 1,
      stats: { exercisesAttempted: 9, byCategory: { movement: { attempted: 4, firstTry: 3 }, scoring: { attempted: 2, firstTry: 1 }, strategy: { attempted: 3, firstTry: 2 } } },
    });
    expect(upgraded.version).toBe(2);
    expect(upgraded.stats).toMatchObject({
      exercisesAttempted: 9,
      bySkill: { rules: { attempted: 6, firstTry: 4, recent: '' }, plans: { attempted: 3, firstTry: 2 } },
    });
    expect('byCategory' in upgraded.stats).toBe(false);
  });

  it('leaves current saves and unreadable ones alone', () => {
    const current = initialProgress();
    expect(upgradeProgress(current)).toBe(current);
    expect(upgradeProgress(null)).toBeNull();
    expect(upgradeProgress({ stats: 'broken' })).toEqual({ stats: 'broken' });
  });

  it('keeps only known skills with the expected fields', () => {
    const checked = checkedSkillStats({
      hitting: { attempted: 3, firstTry: 2, recent: '110', days: 1 },
      made_up: { attempted: 3, firstTry: 2, recent: '110', days: 1 },
      pips: { attempted: 'x' },
    });
    expect(Object.keys(checked)).toEqual(['hitting']);
    expect(checked.hitting).toMatchObject({ lastDay: null, lastFirstTryDay: null });
    expect(checkedSkillStats('nope')).toEqual({});
  });
});
