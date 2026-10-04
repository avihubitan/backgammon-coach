import { emptyLessonRecord, shiftDay, type LessonRecords } from '@/features/learning/progression';
import { checkedSkillLevels, emptySkillStats, raiseSkillLevels, type SkillStats } from '@/features/learning/progressModel';
import type { UserMistake } from '@/features/practice/mistakes';
import { REVIEW_HEADLINES } from '@/game';

import {
  allMastery,
  MASTERY_RULES,
  MASTERY_XP,
  masteryLevels,
  masteryUps,
  skillMastery,
  type MasteryInput,
} from '../mastery';

const today = '2026-10-04';
const done = (...ids: string[]): LessonRecords =>
  Object.fromEntries(ids.map((id) => [id, { ...emptyLessonRecord(), completed: true }]));
const stats = (patch: Partial<SkillStats>): SkillStats => ({ ...emptySkillStats(), lastDay: today, lastFirstTryDay: today, ...patch });
const input = (patch: Partial<MasteryInput> = {}): MasteryInput => ({ lessons: {}, bySkill: {}, drillLevels: {}, mistakes: [], today, ...patch });
const cleared = { attempted: 5, firstTry: 5 };
const gameMistake = (id: string, patch: Partial<UserMistake> = {}) =>
  ({
    id,
    gameId: 'g',
    category: 'risk',
    headline: REVIEW_HEADLINES.safer,
    createdAt: `${shiftDay(today, -2)}T10:00:00`,
    solved: 0,
    attempts: 0,
    streak: 0,
    ...patch,
  }) as UserMistake;

/** Playing safe, with answers good enough for Strong and its drill's first level cleared. */
const strongSafety = (patch: Partial<MasteryInput> = {}) =>
  input({
    lessons: done('points-1', 'points-2'),
    bySkill: { safety: stats({ attempted: 16, firstTry: 14, recent: '111101111111', days: 3 }) },
    drillLevels: { safety: { classics: cleared } },
    ...patch,
  });

describe('skill mastery', () => {
  it('starts once a lesson has taught the skill', () => {
    expect(skillMastery('shots', input())).toMatchObject({ level: 'none', next: 'Finish the lesson “How Risky Is a Blot?” to start.' });
    expect(skillMastery('shots', input({ lessons: done('hitting-4') })).level).toBe('introduced');
    // A lesson that also trains it counts too.
    expect(skillMastery('escaping', input({ lessons: done('position-2') })).level).toBe('introduced');
  });

  it('is Practising after answers on more than one day', () => {
    const lessons = done('hitting-4');
    const practised = stats({ attempted: 8, firstTry: 5, recent: '10110110', days: 2 });
    expect(skillMastery('shots', input({ lessons, bySkill: { shots: practised } })).level).toBe('practised');
    const oneDay = skillMastery('shots', input({ lessons, bySkill: { shots: { ...practised, days: 1 } } }));
    expect(oneDay).toMatchObject({ level: 'introduced', next: 'Practise it on one more day.' });
    const fewAnswers = skillMastery('shots', input({ lessons, bySkill: { shots: stats({ attempted: 4, recent: '1111', days: 1 }) } }));
    expect(fewAnswers.next).toBe('Answer 4 more questions about it.');
    expect(fewAnswers.progress).toBeCloseTo(0.5);
  });

  it('is Strong when the latest answers are reliable, a drill level is cleared, and it holds up in games', () => {
    expect(skillMastery('safety', strongSafety()).level).toBe('reliable');
    // Not without clearing a level of its drill.
    const noLevel = skillMastery('safety', strongSafety({ drillLevels: {} }));
    expect(noLevel).toMatchObject({ level: 'practised', next: 'Clear a level of the “Play it safe” drill.' });
    // Not while the latest answers are shaky, even with a good total.
    const shaky = skillMastery('safety', strongSafety({ bySkill: { safety: stats({ attempted: 30, firstTry: 24, recent: '110100110111', days: 4 }) } }));
    expect(shaky).toMatchObject({ level: 'practised', next: 'Get more right on the first try: 8 of your last 12 so far.' });
    // Not while the same mistake keeps coming up in games.
    const pattern = ['a', 'b', 'c'].map((id) => gameMistake(id));
    expect(skillMastery('safety', strongSafety({ mistakes: pattern }))).toMatchObject({
      level: 'practised',
      gameMistakes: 3,
      next: 'Fix the 3 positions you got wrong in recent games.',
    });
    // Mistakes fixed for good, or from a while ago, don't hold it back.
    const fixed = pattern.map((mistake) => ({ ...mistake, streak: 3 }));
    expect(skillMastery('safety', strongSafety({ mistakes: fixed })).level).toBe('reliable');
    const old = pattern.map((mistake) => ({ ...mistake, createdAt: `${shiftDay(today, -30)}T10:00:00` }));
    expect(skillMastery('safety', strongSafety({ mistakes: old })).level).toBe('reliable');
  });

  it('needs no drill for a skill that has none', () => {
    const cube = stats({ attempted: 16, firstTry: 15, recent: '111111111111', days: 3 });
    expect(skillMastery('cube', input({ lessons: done('cube-1'), bySkill: { cube } })).level).toBe('reliable');
  });

  it('is Mastered when it lasts: more days, every level cleared, no open game mistakes', () => {
    const mastered = stats({ attempted: 32, firstTry: 30, recent: '111111111111', days: 5 });
    const all = { safety: { classics: cleared, 'no-blots': cleared } };
    expect(skillMastery('safety', strongSafety({ bySkill: { safety: mastered }, drillLevels: all })).level).toBe('mastered');
    const levelLeft = skillMastery('safety', strongSafety({ bySkill: { safety: mastered } }));
    expect(levelLeft).toMatchObject({ level: 'reliable', next: 'Clear “Leave no blots” in the “Play it safe” drill.' });
    const oneMistake = skillMastery('safety', strongSafety({ bySkill: { safety: mastered }, drillLevels: all, mistakes: [gameMistake('a')] }));
    expect(oneMistake).toMatchObject({ level: 'reliable', next: 'Fix the position you got wrong in a recent game.' });
    const longAgo = shiftDay(today, -MASTERY_RULES.mastered.freshDays - 5);
    const stale = skillMastery(
      'safety',
      strongSafety({ bySkill: { safety: { ...mastered, lastDay: longAgo, lastFirstTryDay: longAgo } }, drillLevels: all }),
    );
    expect(stale).toMatchObject({ level: 'reliable', fading: true, next: 'Get one right again: it’s been a while.' });
  });

  it('says when a skill is fading', () => {
    const lessons = done('hitting-4');
    const practised = stats({ attempted: 8, firstTry: 6, recent: '11011101', days: 2 });
    expect(skillMastery('shots', input({ lessons, bySkill: { shots: practised } })).fading).toBe(false);
    const away = shiftDay(today, -MASTERY_RULES.fadingDays);
    expect(skillMastery('shots', input({ lessons, bySkill: { shots: { ...practised, lastDay: away } } })).fading).toBe(true);
  });

  it('lists the skills lessons have taught, in path order', () => {
    const skills = allMastery(input({ lessons: done('board-1', 'hitting-1', 'points-2') }));
    expect(skills.map((skill) => skill.skill)).toEqual(['board', 'hitting', 'safety']);
    for (const skill of skills) {
      expect(skill.progress).toBeGreaterThanOrEqual(0);
      expect(skill.progress).toBeLessThanOrEqual(1);
      expect(skill.next).toBeTruthy();
    }
    expect(masteryLevels(strongSafety())).toMatchObject({ points: 'introduced', safety: 'reliable' });
  });
});

describe('mastery rewards', () => {
  it('pays each level once, from where the session started', () => {
    expect(masteryUps({}, {}, { safety: 'reliable' })).toEqual([
      { skill: 'safety', level: 'reliable', xp: MASTERY_XP.practised + MASTERY_XP.reliable },
    ]);
    expect(masteryUps({ safety: 'practised' }, {}, { safety: 'reliable' })).toEqual([
      { skill: 'safety', level: 'reliable', xp: MASTERY_XP.reliable },
    ]);
    // Reached before (then held back by game mistakes): no second payout.
    expect(masteryUps({ safety: 'practised' }, { safety: 'reliable' }, { safety: 'reliable' })).toEqual([]);
    // Nothing new, or lower.
    expect(masteryUps({ safety: 'reliable' }, {}, { safety: 'practised' })).toEqual([]);
    expect(masteryUps({}, {}, { board: 'introduced' })).toEqual([{ skill: 'board', level: 'introduced', xp: 0 }]);
  });

  it('saves the highest level reached and ignores anything unknown', () => {
    expect(raiseSkillLevels({ safety: 'reliable', hitting: 'introduced' }, { safety: 'practised', hitting: 'practised' })).toEqual({
      safety: 'reliable',
      hitting: 'practised',
    });
    expect(checkedSkillLevels({ safety: 'reliable', bogus: 'mastered', points: 'legendary', hitting: 3 })).toEqual({ safety: 'reliable' });
    expect(checkedSkillLevels('nope')).toEqual({});
  });
});
