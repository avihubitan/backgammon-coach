/**
 * Saved data is read back through these checks: whatever still has the
 * expected shape is kept and anything else falls back to its default, so one
 * bad field (an interrupted write, a save from an old version) can't stop the
 * app from starting or lose the rest of the player's progress.
 */

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Fixed-shape objects are checked field by field (unknown fields are kept, for
 * saves from newer versions). Maps, which are empty objects in the defaults,
 * are kept when they are objects: check their entries with `keepEntries`.
 * A `null` default accepts any saved value.
 */
export function withDefaults<T>(defaults: T, saved: unknown): T {
  if (saved === undefined) return defaults;
  if (defaults === null) return saved as T;
  if (typeof defaults === 'number') return (typeof saved === 'number' && Number.isFinite(saved) ? saved : defaults) as T;
  if (typeof defaults !== 'object') return (typeof saved === typeof defaults ? saved : defaults) as T;
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T;
  if (!isPlainObject(saved)) return defaults;
  const shape = defaults as Record<string, unknown>;
  if (Object.keys(shape).length === 0) return saved as T;
  const checked: Record<string, unknown> = { ...saved };
  for (const key of Object.keys(shape)) checked[key] = withDefaults(shape[key], saved[key]);
  return checked as T;
}

/** Drops the entries of a saved map that fail `valid`. */
export function keepEntries<V>(map: Record<string, unknown>, valid: (value: unknown) => boolean): Record<string, V> {
  return Object.fromEntries(Object.entries(map).filter(([, value]) => valid(value))) as Record<string, V>;
}

/** zustand `persist` merge: the current (default) state, overlaid with what survives the checks. */
export function mergeChecked<S, P>(defaults: P, check: (saved: P) => P = (saved) => saved) {
  return (persisted: unknown, current: S): S => ({ ...current, ...check(withDefaults(defaults, persisted)) });
}
