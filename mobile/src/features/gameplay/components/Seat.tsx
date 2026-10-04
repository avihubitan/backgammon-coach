import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CheckerFace } from '@/components/board/Checker';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { Player } from '@/game';
import { colors, radii, spacing } from '@/theme';

/** What the player in a seat is doing right now. */
export type SeatActivity = 'your-turn' | 'thinking' | null;

interface SeatProps {
  testID?: string;
  name: string;
  /** Second line: level, pips, checkers off. */
  detail: string;
  /** The opponent's face, or the player's own checker. */
  avatar: { icon: IconName; color: string } | { checker: Player };
  active: boolean;
  activity: SeatActivity;
  /** The cube's value when this player owns it. */
  cube?: number | null;
  /** Match score, in matches. */
  score?: number | null;
  height: number;
  compact: boolean;
  /** A line the player at this seat just said (a new key for each). */
  speech?: { key: number; text: string } | null;
}

/**
 * One side of the table: who sits there, how they stand, and whether it's
 * their move. The active seat lights up; the other one steps back.
 */
export function Seat({ testID, name, detail, avatar, active, activity, cube, score, height, compact, speech }: SeatProps) {
  const size = compact ? 30 : 36;
  return (
    <View
      testID={testID}
      style={[styles.seat, { height }]}
      accessibilityLabel={`${name}, ${detail}${activity === 'your-turn' ? ', your turn' : activity === 'thinking' ? ', thinking' : ''}`}
    >
      <View
        style={[
          styles.avatar,
          { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 },
          active ? styles.avatarActive : styles.avatarIdle,
        ]}
      >
        {'checker' in avatar ? (
          <CheckerFace player={avatar.checker} size={size - 2} />
        ) : (
          <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${avatar.color}22` }]}>
            <Icon name={avatar.icon} size={size * 0.56} color={avatar.color} />
          </View>
        )}
      </View>
      <View style={[styles.flex, !active && styles.idle]}>
        <AppText variant={compact ? 'smallStrong' : 'subheading'} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      {cube ? (
        <View style={styles.cube} accessibilityLabel={`Owns the cube at ${cube}`}>
          <AppText variant="caption" color="textInverse">
            {cube}
          </AppText>
        </View>
      ) : null}
      {score !== null && score !== undefined ? (
        <View style={styles.score} accessibilityLabel={`Score ${score}`}>
          <AppText variant="number">{score}</AppText>
        </View>
      ) : null}
      {activity ? <TurnBadge key={activity} activity={activity} /> : null}
      {speech ? <SpeechBubble key={speech.key} text={speech.text} left={size + 6 + spacing.sm + spacing.xs} /> : null}
    </View>
  );
}

/** A line from the opponent, next to its face: in, a moment to read, out. */
function SpeechBubble({ text, left }: { text: string; left: number }) {
  return (
    <Animated.View
      testID="opponent-speech"
      accessibilityLiveRegion="polite"
      style={[
        styles.speech,
        {
          left,
          animationName: {
            '0%': { opacity: 0, transform: [{ translateX: -6 }, { scale: 0.96 }] },
            '8%': { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
            '88%': { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }] },
            '100%': { opacity: 0, transform: [{ translateX: 0 }, { scale: 1 }] },
          },
          animationDuration: 2800,
          animationFillMode: 'forwards',
        },
      ]}
    >
      <View style={styles.tail} />
      <AppText variant="smallStrong" numberOfLines={2}>
        {text}
      </AppText>
    </Animated.View>
  );
}

function TurnBadge({ activity }: { activity: NonNullable<SeatActivity> }) {
  const mine = activity === 'your-turn';
  return (
    <Animated.View
      testID={mine ? 'turn-badge-you' : 'turn-badge-opponent'}
      style={[
        styles.badge,
        mine ? styles.badgeMine : styles.badgeTheirs,
        {
          animationName: { from: { opacity: 0, transform: [{ translateX: 8 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } },
          animationDuration: 220,
          animationTimingFunction: 'ease-out',
        },
      ]}
    >
      {mine ? <Animated.View style={[styles.dot, BREATHE]} /> : null}
      <AppText variant="caption" color={mine ? 'primary' : 'textSecondary'}>
        {mine ? 'Your turn' : 'Thinking'}
      </AppText>
      {mine ? null : <ThinkingDots />}
    </Animated.View>
  );
}

/** Three dots that fill in turn: someone is thinking, without a spinner. */
function ThinkingDots() {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.thinkDot,
            {
              animationName: { '0%': { opacity: 0.25 }, '40%': { opacity: 1 }, '80%': { opacity: 0.25 }, '100%': { opacity: 0.25 } },
              animationDuration: 1100,
              animationDelay: index * 180,
              animationIterationCount: 'infinite',
            },
          ]}
        />
      ))}
    </View>
  );
}

const BREATHE = {
  animationName: { from: { opacity: 0.45, transform: [{ scale: 0.8 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
  animationDuration: 900,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
} as const;

const styles = StyleSheet.create({
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  flex: { flex: 1, minWidth: 0 },
  idle: { opacity: 0.62 },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarActive: { borderColor: colors.primary, boxShadow: `0px 0px 10px rgba(243, 184, 71, 0.45)` },
  avatarIdle: { borderColor: 'transparent', opacity: 0.75 },
  face: { alignItems: 'center', justifyContent: 'center' },
  cube: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#F6EFDF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    minWidth: 34,
    height: 30,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  badgeMine: { backgroundColor: colors.primarySoft, borderColor: 'rgba(243, 184, 71, 0.4)' },
  badgeTheirs: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  dots: { flexDirection: 'row', gap: 3, marginLeft: -2 },
  thinkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary },
  speech: {
    position: 'absolute',
    right: spacing.xs,
    top: 4,
    bottom: 4,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    zIndex: 5,
  },
  tail: {
    position: 'absolute',
    left: -5,
    top: '50%',
    marginTop: -5,
    width: 10,
    height: 10,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
});
