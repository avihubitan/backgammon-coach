import { initialProgress } from '@/features/learning/progressModel';

import { keepEntries, mergeChecked, withDefaults } from '../sanitize';

describe('reading saved data back', () => {
  const defaults = { name: 'x', count: 0, on: false, when: null as string | null, list: [] as number[], map: {}, nested: { a: 1, b: 'b' } };

  it('keeps values of the expected type', () => {
    const saved = { name: 'y', count: 3, on: true, when: '2026-03-10', list: [1, 2], map: { k: 1 }, nested: { a: 2, b: 'c' } };
    expect(withDefaults(defaults, saved)).toEqual(saved);
  });

  it('falls back field by field, keeping the rest', () => {
    const saved = { name: 7, count: 'many', on: 'yes', list: 'no', map: [], nested: { a: 'one', b: 'kept' } };
    expect(withDefaults(defaults, saved)).toEqual({ ...defaults, nested: { a: 1, b: 'kept' } });
  });

  it('rejects numbers that are not finite', () => {
    expect(withDefaults({ xp: 0 }, { xp: Number.NaN })).toEqual({ xp: 0 });
    expect(withDefaults({ xp: 0 }, { xp: Number.POSITIVE_INFINITY })).toEqual({ xp: 0 });
  });

  it('uses the defaults for anything that is not an object at all', () => {
    expect(withDefaults(defaults, null)).toBe(defaults);
    expect(withDefaults(defaults, 'corrupt')).toBe(defaults);
    expect(withDefaults(defaults, undefined)).toBe(defaults);
  });

  it('keeps fields it doesn’t know, for saves from a newer version', () => {
    expect(withDefaults({ a: 1 }, { a: 2, future: true })).toEqual({ a: 2, future: true });
  });

  it('filters the entries of a map', () => {
    expect(keepEntries({ a: 1, b: 'x', c: 3 }, (value) => typeof value === 'number')).toEqual({ a: 1, c: 3 });
  });

  it('repairs a progress save with a broken streak without losing lessons or XP', () => {
    const saved = { ...initialProgress(), xp: 420, lessons: { 'board-1': { completed: true } }, streak: null };
    type Progress = ReturnType<typeof initialProgress>;
    const merge = mergeChecked<{ hydrated: boolean } & Progress, Progress>(initialProgress());
    const state = merge(saved, { hydrated: true, ...initialProgress() });
    expect(state.hydrated).toBe(true);
    expect(state.xp).toBe(420);
    expect(state.lessons['board-1']).toEqual({ completed: true });
    expect(state.streak).toEqual(initialProgress().streak);
  });
});
