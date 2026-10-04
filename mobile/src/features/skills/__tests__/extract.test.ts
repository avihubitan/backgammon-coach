import { getLesson, SKILL_IDS } from '@/curriculum';
import { REVIEW_HEADLINES, type MistakeCategory } from '@/game';

import { skillOfDrill, skillOfMistake, trainingFor } from '../extract';

const CATEGORIES: MistakeCategory[] = ['opening', 'hitting', 'positioning', 'running', 'racing', 'bearing-off', 'cube', 'risk'];

describe('skill extraction', () => {
  it('files every review headline under the skill it is about', () => {
    expect(skillOfMistake({ category: 'hitting', headline: REVIEW_HEADLINES.missedHit })).toBe('hitting');
    expect(skillOfMistake({ category: 'hitting', headline: REVIEW_HEADLINES.pressure })).toBe('hitting');
    expect(skillOfMistake({ category: 'positioning', headline: REVIEW_HEADLINES.anchor })).toBe('anchors');
    expect(skillOfMistake({ category: 'positioning', headline: REVIEW_HEADLINES.point })).toBe('points');
    expect(skillOfMistake({ category: 'positioning', headline: REVIEW_HEADLINES.structure })).toBe('points');
    // Hitting loosely and leaving shots is a safety lesson, not a hitting one.
    expect(skillOfMistake({ category: 'hitting', headline: REVIEW_HEADLINES.safer })).toBe('safety');
    expect(skillOfMistake({ category: 'risk', headline: REVIEW_HEADLINES.slightlySafer })).toBe('safety');
    expect(skillOfMistake({ category: 'running', headline: REVIEW_HEADLINES.backCheckers })).toBe('escaping');
    expect(skillOfMistake({ category: 'racing', headline: REVIEW_HEADLINES.raceEfficiently })).toBe('racing');
    expect(skillOfMistake({ category: 'bearing-off', headline: REVIEW_HEADLINES.bearOffMore })).toBe('bear-off');
    expect(skillOfMistake({ category: 'bearing-off', headline: REVIEW_HEADLINES.smootherBearOff })).toBe('bear-off');
  });

  it('treats any first move as an openings question', () => {
    expect(skillOfMistake({ category: 'opening', headline: REVIEW_HEADLINES.missedHit })).toBe('openings');
  });

  it('falls back to the category for saves without a known headline', () => {
    for (const category of CATEGORIES) {
      expect(SKILL_IDS).toContain(skillOfMistake({ category, headline: 'Something from an old version' }));
    }
    expect(skillOfMistake({ category: 'cube', headline: '' })).toBe('cube');
  });

  it('knows where each skill is taught, and a drill where there is one', () => {
    for (const skill of SKILL_IDS) {
      const { lesson } = trainingFor(skill);
      expect(lesson && getLesson(lesson.id)).toBeTruthy();
    }
    expect(trainingFor('hitting')).toMatchObject({ drill: 'hitting', lesson: { id: 'hitting-1' } });
    expect(trainingFor('safety')).toMatchObject({ drill: 'safety', lesson: { id: 'points-2' } });
    expect(trainingFor('shots').lesson?.id).toBe('hitting-4');
    expect(trainingFor('pips')).toMatchObject({ drill: 'race', lesson: { id: 'bearoff-4' } });
    expect(skillOfDrill('race')).toBe('pips');
  });
});
