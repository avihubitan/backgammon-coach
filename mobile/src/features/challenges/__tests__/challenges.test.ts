import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import {
  applyChallengeEvent,
  challengeForDay,
  CHALLENGES,
  startDaily,
  type ChallengeContext,
} from '../challenges';

const beginner: ChallengeContext = {
  completedSections: [],
  unlockedDrills: [],
  playUnlocked: false,
  openMistakes: 0,
  canPracticeMistakes: false,
};
const advanced: ChallengeContext = {
  completedSections: ['board', 'moving', 'hitting', 'points', 'position', 'bearing-off'],
  unlockedDrills: ['hitting', 'safety', 'points', 'bear-off', 'race'],
  playUnlocked: true,
  openMistakes: 5,
  canPracticeMistakes: true,
};

describe('daily challenges', () => {
  it('uses unique ids and real icons', () => {
    expect(new Set(CHALLENGES.map((challenge) => challenge.id)).size).toBe(CHALLENGES.length);
    for (const challenge of CHALLENGES) {
      expect(Object.prototype.hasOwnProperty.call(glyphs, challenge.icon)).toBe(true);
      expect(challenge.target).toBeGreaterThan(0);
      expect(challenge.xp).toBeGreaterThan(0);
    }
  });

  it('only offers challenges the learner can actually do', () => {
    for (let day = 1; day <= 28; day++) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      expect(challengeForDay(key, beginner).available(beginner)).toBe(true);
      expect(['exercises', 'first-try']).toContain(challengeForDay(key, beginner).id);
    }
  });

  it('is stable for a day and varies across days', () => {
    expect(challengeForDay('2026-10-02', advanced).id).toBe(challengeForDay('2026-10-02', advanced).id);
    const ids = new Set(
      Array.from({ length: 30 }, (_, day) => challengeForDay(`2026-11-${String(day + 1).padStart(2, '0')}`, advanced).id),
    );
    expect(ids.size).toBeGreaterThan(4);
  });

  it('leans on the drill the coach would pick, every other day', () => {
    const focused = { ...advanced, focusDrill: 'safety' as const };
    const days = Array.from({ length: 30 }, (_, day) => `2026-11-${String(day + 1).padStart(2, '0')}`);
    const picks = days.map((day) => challengeForDay(day, focused).id);
    const share = picks.filter((id) => id === 'drill-safety').length / days.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.8);
    // Still a mix of challenges, and never a drill the learner hasn't opened.
    expect(new Set(picks).size).toBeGreaterThan(3);
    for (const day of days) expect(challengeForDay(day, { ...advanced, focusDrill: 'cube' as never }).available(advanced)).toBe(true);
    expect(days.map((day) => challengeForDay(day, { ...advanced, focusDrill: 'primes' }).id)).not.toContain('drill-primes');
  });

  it('counts matching events and completes exactly once', () => {
    let state = { ...startDaily('2026-10-02', advanced), id: 'hit-blots' };
    const now = '2026-10-02T10:00:00Z';
    expect(applyChallengeEvent(state, { type: 'exercise-correct', firstTry: true }, now).state.progress).toBe(0);
    let completions = 0;
    for (let i = 0; i < 5; i++) {
      const result = applyChallengeEvent(state, { type: 'hit' }, now);
      state = result.state;
      if (result.completed) completions++;
    }
    expect(state.progress).toBe(3);
    expect(state.completedAt).toBe(now);
    expect(completions).toBe(1);
  });

  it('matches drill sessions by category', () => {
    const state = { ...startDaily('2026-10-02', advanced), id: 'drill-safety' };
    const now = '2026-10-02T10:00:00Z';
    expect(applyChallengeEvent(state, { type: 'practice-session', category: 'hitting' }, now).completed).toBe(false);
    expect(applyChallengeEvent(state, { type: 'practice-session', category: 'safety' }, now).completed).toBe(true);
  });
});
