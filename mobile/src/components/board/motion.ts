import type { Player } from '@/game';

import {
  checkerCenterOnBar,
  checkerCenterOnPoint,
  slabRectInTray,
  type BoardMetrics,
  type Point2D,
} from './geometry';
import { stackKey, stackSizes, type PlacedChecker } from './layout';

/**
 * Turns a layout change into choreography: which checkers fly where, when,
 * how high, where hits land, and when to play sounds. Pure, so the timing
 * rules are testable without rendering anything.
 */

export type MotionKind = 'move' | 'hit' | 'bearoff';

export interface Motion {
  kind: MotionKind;
  /** ms to wait before taking off (hit checkers wait for the hitter to land). */
  delay: number;
  duration: number;
  /** Extra scale at the top of the flight: how "high" the checker is lifted. */
  hop: number;
  /** Start here instead of the old spot: a checker dropped by the player settles from the finger. */
  from?: Point2D;
}

/** A checker the player just dragged and released at `at`. */
export interface DropInfo {
  player: Player;
  at: Point2D;
}

/** How long a dropped checker takes to settle into its spot. */
export const SETTLE_MS = 170;

export interface Impact {
  id: string;
  at: Point2D;
  /** ms after the update when the hitter lands. */
  delay: number;
  /** The player whose checker was hit. */
  victim: Player;
}

export type SoundCueKind = 'place' | 'hit' | 'bearoff';

export interface SoundCue {
  at: number;
  kind: SoundCueKind;
}

export interface MotionPlan {
  motions: Record<string, Motion>;
  impacts: Impact[];
  cues: SoundCue[];
  /** When everything has settled, in ms. */
  totalMs: number;
}

export const EMPTY_PLAN: MotionPlan = { motions: {}, impacts: [], cues: [], totalMs: 0 };

/** Several checkers moving at once take off one after another. */
export const STAGGER_MS = 90;

export function checkerCenter(m: BoardMetrics, checker: PlacedChecker, sizes: Map<string, number>): Point2D {
  const count = sizes.get(stackKey(checker)) ?? 1;
  if (checker.location.kind === 'point') {
    return checkerCenterOnPoint(m, checker.location.point, checker.index, count);
  }
  if (checker.location.kind === 'bar') return checkerCenterOnBar(m, checker.player, checker.index, count);
  const slab = slabRectInTray(m, checker.player, checker.index);
  return { x: slab.x + slab.width / 2, y: slab.y + slab.height / 2 };
}

/** Longer trips take a little longer, but never feel sluggish. */
export function flightDuration(distance: number, m: BoardMetrics): number {
  return Math.round(Math.min(MAX_FLIGHT_MS, Math.max(220, 200 + (distance / m.width) * 380)));
}

const MAX_FLIGHT_MS = 420;

/**
 * Time between the hops of a multi-step move (one die after another): long
 * enough for each flight to land before the next one takes off.
 */
export const MOVE_STEP_MS = MAX_FLIGHT_MS + 20;

export function planMotions(
  previous: readonly PlacedChecker[],
  next: readonly PlacedChecker[],
  m: BoardMetrics,
  updateId: number | string,
  drop?: DropInfo,
): MotionPlan {
  const before = new Map(previous.map((checker) => [checker.id, checker]));
  const previousSizes = stackSizes(previous);
  const nextSizes = stackSizes(next);
  const motions: Record<string, Motion> = {};
  const impacts: Impact[] = [];
  const cues: SoundCue[] = [];

  const moved = next
    .filter((checker) => checker.moved && before.has(checker.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const isVictim = (checker: PlacedChecker) => {
    const old = before.get(checker.id);
    return checker.location.kind === 'bar' && old?.location.kind === 'point';
  };

  // Movers first: they set the clock for any hits.
  const arrivals = new Map<string, number>();
  const staggerByPlayer = new Map<Player, number>();
  let dropUsed = false;
  for (const checker of moved) {
    if (isVictim(checker)) continue;
    const old = before.get(checker.id)!;
    const kind: MotionKind = checker.location.kind === 'off' ? 'bearoff' : 'move';
    if (drop && !dropUsed && checker.player === drop.player) {
      // The player carried this one: it settles from where it was released.
      dropUsed = true;
      motions[checker.id] = { kind, delay: 0, duration: SETTLE_MS, hop: 0.04, from: drop.at };
      if (checker.location.kind === 'point') {
        const point = `${checker.location.point}`;
        arrivals.set(point, Math.max(arrivals.get(point) ?? 0, SETTLE_MS));
      }
      continue;
    }
    const from = checkerCenter(m, old, previousSizes);
    const to = checkerCenter(m, checker, nextSizes);
    const order = staggerByPlayer.get(checker.player) ?? 0;
    staggerByPlayer.set(checker.player, order + 1);
    const delay = order * STAGGER_MS;
    const duration = flightDuration(Math.hypot(to.x - from.x, to.y - from.y), m);
    motions[checker.id] = { kind, delay, duration, hop: 0.18 };
    if (checker.location.kind === 'point') {
      arrivals.set(`${checker.location.point}`, Math.max(arrivals.get(`${checker.location.point}`) ?? 0, delay + duration));
    }
  }

  // Hit checkers wait for the hitter, get knocked up higher and fly to the bar.
  const hitPoints = new Set<string>();
  for (const checker of moved) {
    if (!isVictim(checker)) continue;
    const old = before.get(checker.id)!;
    const point = old.location.kind === 'point' ? old.location.point : 0;
    const from = checkerCenter(m, old, previousSizes);
    const to = checkerCenter(m, checker, nextSizes);
    const landing = arrivals.get(`${point}`);
    const delay = landing !== undefined ? Math.max(0, landing - 40) : 0;
    const duration = flightDuration(Math.hypot(to.x - from.x, to.y - from.y), m) + 40;
    motions[checker.id] = { kind: 'hit', delay, duration, hop: 0.3 };
    if (landing !== undefined) {
      impacts.push({ id: `${updateId}:${checker.id}`, at: from, delay: landing, victim: checker.player });
      hitPoints.add(`${point}`);
    }
    cues.push({ at: delay + duration, kind: 'place' });
  }

  for (const checker of moved) {
    const motion = motions[checker.id];
    if (!motion || motion.kind === 'hit') continue;
    const at = motion.delay + motion.duration;
    const landedOnHit = checker.location.kind === 'point' && hitPoints.has(`${checker.location.point}`);
    cues.push({ at, kind: motion.kind === 'bearoff' ? 'bearoff' : landedOnHit ? 'hit' : 'place' });
  }
  cues.sort((a, b) => a.at - b.at);

  const totalMs = Object.values(motions).reduce((max, motion) => Math.max(max, motion.delay + motion.duration), 0);
  return { motions, impacts, cues, totalMs };
}

/** Collapses cues that land within `windowMs` of each other (the loudest kind wins). */
export function mergeCues(cues: readonly SoundCue[], windowMs = 45): SoundCue[] {
  const rank: Record<SoundCueKind, number> = { hit: 3, bearoff: 2, place: 1 };
  const merged: SoundCue[] = [];
  for (const cue of [...cues].sort((a, b) => a.at - b.at)) {
    const last = merged[merged.length - 1];
    if (last && cue.at - last.at < windowMs) {
      if (rank[cue.kind] > rank[last.kind]) merged[merged.length - 1] = { at: last.at, kind: cue.kind };
      continue;
    }
    merged.push({ ...cue });
  }
  return merged;
}
