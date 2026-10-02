import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { feedback } from '@/services/feedback';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

import { ParticleBurst } from './ParticleBurst';

interface LevelUpOverlayProps {
  level: number;
  onClose: () => void;
}

const BADGE = 132;
const RAYS = 16;

/** Full-screen "Level up!" moment: rays, a badge that slams in, confetti and a fanfare. */
export function LevelUpOverlay({ level, onClose }: LevelUpOverlayProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rayRadius = Math.max(width, height) * 0.75;
  const centerY = height * 0.36;

  useEffect(() => {
    feedback.levelUp();
  }, []);

  const rays = Array.from({ length: RAYS }, (_, index) => {
    const angle = (index / RAYS) * Math.PI * 2;
    const half = (Math.PI / RAYS) * 0.42;
    const p1 = `${rayRadius + Math.cos(angle - half) * rayRadius},${rayRadius + Math.sin(angle - half) * rayRadius}`;
    const p2 = `${rayRadius + Math.cos(angle + half) * rayRadius},${rayRadius + Math.sin(angle + half) * rayRadius}`;
    return `${rayRadius},${rayRadius} ${p1} ${p2}`;
  });

  return (
    <Animated.View
      testID="level-up"
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
      style={[
        styles.root,
        {
          animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
          animationDuration: 250,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rays,
          {
            left: width / 2 - rayRadius,
            top: centerY - rayRadius,
            width: rayRadius * 2,
            height: rayRadius * 2,
            animationName: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
            animationDuration: 16000,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          },
        ]}
      >
        <Svg width={rayRadius * 2} height={rayRadius * 2}>
          {rays.map((points, index) => (
            <Polygon key={index} points={points} fill={colors.primary} opacity={index % 2 === 0 ? 0.14 : 0.07} />
          ))}
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.glow, { left: width / 2 - BADGE, top: centerY - BADGE }]} />

      <ParticleBurst
        x={width / 2}
        y={centerY}
        delay={260}
        count={26}
        radius={width * 0.5}
        size={9}
        gravity={160}
        duration={1300}
        shapes={['confetti', 'star', 'circle']}
        colors={[colors.primary, colors.success, colors.info, colors.streak, '#FFFFFF']}
        seed={level}
      />
      <ParticleBurst
        x={width / 2}
        y={centerY}
        delay={620}
        count={18}
        radius={width * 0.36}
        size={7}
        gravity={120}
        duration={1100}
        shapes={['star', 'circle']}
        colors={[colors.star, '#FFE9A8', '#FFFFFF']}
        seed={level + 99}
      />

      <Animated.View
        style={[
          styles.badgeEdge,
          {
            left: width / 2 - BADGE / 2,
            top: centerY - BADGE / 2,
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: 0.1 }, { rotate: '-90deg' }] },
              '55%': { opacity: 1, transform: [{ scale: 1.22 }, { rotate: '8deg' }] },
              '75%': { opacity: 1, transform: [{ scale: 0.94 }, { rotate: '-3deg' }] },
              '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
            },
            animationDuration: 700,
            animationDelay: 120,
            animationFillMode: 'backwards',
            animationTimingFunction: 'ease-out',
          },
        ]}
      >
        <View style={styles.badgeFace}>
          <AppText variant="label" color="textInverse">
            Level
          </AppText>
          <AppText variant="display" color="textInverse" style={styles.levelNumber} testID="level-up-number">
            {level}
          </AppText>
        </View>
      </Animated.View>

      <View style={[styles.text, { top: centerY + BADGE / 2 + spacing.xxl }]}>
        <Animated.View
          style={{
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: 0.5 }] },
              '70%': { opacity: 1, transform: [{ scale: 1.12 }] },
              '100%': { opacity: 1, transform: [{ scale: 1 }] },
            },
            animationDuration: 460,
            animationDelay: 520,
            animationFillMode: 'backwards',
          }}
        >
          <AppText variant="display" color="primary" align="center">
            Level up!
          </AppText>
        </Animated.View>
        <Animated.View
          style={{
            animationName: { from: { opacity: 0, transform: [{ translateY: 12 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
            animationDuration: 380,
            animationDelay: 800,
            animationFillMode: 'backwards',
          }}
        >
          <AppText variant="body" color="textSecondary" align="center">
            You reached level {level}. Every lesson makes you a sharper player.
          </AppText>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            animationName: { from: { opacity: 0, transform: [{ translateY: 30 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
            animationDuration: 380,
            animationDelay: 1000,
            animationFillMode: 'backwards',
          },
        ]}
      >
        <Button testID="level-up-continue" label="Awesome!" onPress={onClose} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 8, 10, 0.92)',
    zIndex: 400,
    overflow: 'hidden',
  },
  rays: { position: 'absolute' },
  glow: {
    position: 'absolute',
    width: BADGE * 2,
    height: BADGE * 2,
    borderRadius: BADGE,
    backgroundColor: 'rgba(243, 184, 71, 0.10)',
    boxShadow: '0px 0px 80px rgba(243, 184, 71, 0.45)',
  },
  badgeEdge: {
    position: 'absolute',
    width: BADGE,
    height: BADGE + 8,
    borderRadius: BADGE / 2,
    backgroundColor: colors.primaryShadow,
  },
  badgeFace: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFD98A',
  },
  levelNumber: { fontSize: 54, lineHeight: 60 },
  text: { position: 'absolute', left: SCREEN_GUTTER, right: SCREEN_GUTTER, gap: spacing.sm, alignItems: 'center' },
  footer: { position: 'absolute', left: SCREEN_GUTTER, right: SCREEN_GUTTER, bottom: 0 },
});
