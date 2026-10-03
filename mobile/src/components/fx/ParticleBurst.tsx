import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type ParticleShape = 'circle' | 'confetti' | 'spark' | 'star';

export interface ParticleBurstProps {
  /** Centre of the burst in the parent's coordinates. */
  x: number;
  y: number;
  count?: number;
  colors?: readonly string[];
  /** How far the fastest particles travel, in px. */
  radius?: number;
  duration?: number;
  delay?: number;
  /** Extra downward drift by the end, in px. */
  gravity?: number;
  /** Base particle size in px. */
  size?: number;
  shapes?: readonly ParticleShape[];
  /** Deterministic layout so re-renders don't reshuffle the particles. */
  seed?: number;
  /** Limit the spray to an arc (radians); full circle by default. */
  spread?: { from: number; to: number };
}

interface ParticleSpec {
  angle: number;
  distance: number;
  size: number;
  color: string;
  shape: ParticleShape;
  spin: number;
  lag: number;
}

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_COLORS = ['#FFC94D', '#F3B847', '#7CF2C0', '#FFFFFF'] as const;

/**
 * A one-shot spray of particles (confetti, sparks, glints). Every particle is
 * driven by one shared progress value, so the whole burst animates on the UI
 * thread. Renders nothing when the system asks to reduce motion.
 */
export function ParticleBurst({
  x,
  y,
  count = 14,
  colors = DEFAULT_COLORS,
  radius = 70,
  duration = 750,
  delay = 0,
  gravity = 30,
  size = 7,
  shapes = ['circle', 'confetti', 'spark'],
  seed = 1,
  spread,
}: ParticleBurstProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  const particles = useMemo<ParticleSpec[]>(() => {
    const rand = mulberry(seed * 7919 + count);
    const from = spread?.from ?? 0;
    const to = spread?.to ?? Math.PI * 2;
    return Array.from({ length: count }, (_, index) => {
      const slice = (to - from) / count;
      return {
        angle: from + slice * index + slice * rand(),
        distance: radius * (0.45 + 0.55 * rand()),
        size: size * (0.6 + 0.7 * rand()),
        color: colors[Math.floor(rand() * colors.length)],
        shape: shapes[Math.floor(rand() * shapes.length)],
        spin: (rand() - 0.5) * 720,
        lag: rand() * 0.12,
      };
    });
  }, [seed, count, radius, size, colors, shapes, spread?.from, spread?.to]);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [progress, delay, duration]);

  if (reduceMotion) return null;
  return (
    <View style={[styles.origin, { left: x, top: y }, { pointerEvents: 'none' }]}>
      {particles.map((particle, index) => (
        <Particle key={index} spec={particle} progress={progress} gravity={gravity} />
      ))}
    </View>
  );
}

function Particle({ spec, progress, gravity }: { spec: ParticleSpec; progress: SharedValue<number>; gravity: number }) {
  const { angle, distance, size, color, shape, spin, lag } = spec;
  const width = shape === 'spark' ? size * 0.38 : shape === 'confetti' ? size : size;
  const height = shape === 'spark' ? size * 1.7 : shape === 'confetti' ? size * 0.55 : size;
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.value - lag) / (1 - lag)));
    const travel = distance * p;
    const dx = Math.cos(angle) * travel;
    const dy = Math.sin(angle) * travel + gravity * p * p;
    const opacity = p <= 0 ? 0 : p < 0.08 ? p / 0.08 : 1 - Math.pow((p - 0.08) / 0.92, 1.6);
    const scale = shape === 'spark' ? 1 - 0.7 * p : 1 - 0.45 * p;
    const rotate = shape === 'spark' ? (angle * 180) / Math.PI + 90 : spin * p;
    return {
      opacity,
      transform: [{ translateX: dx - width / 2 }, { translateY: dy - height / 2 }, { rotate: `${rotate}deg` }, { scale }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width,
          height,
          backgroundColor: shape === 'star' ? 'transparent' : color,
          borderRadius: shape === 'circle' ? size : shape === 'spark' ? size : 1.5,
        },
        style,
      ]}
    >
      {shape === 'star' ? <StarGlyph size={size} color={color} /> : null}
    </Animated.View>
  );
}

/** A four-point glint built from two thin bars. */
function StarGlyph({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size * 0.22, height: size, borderRadius: size, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: size, height: size * 0.22, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0, overflow: 'visible', zIndex: 95 },
  particle: { position: 'absolute', left: 0, top: 0 },
});
