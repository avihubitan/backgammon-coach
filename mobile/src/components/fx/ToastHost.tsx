import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useToastStore, type Toast } from '@/state/toastStore';
import { colors, MAX_CONTENT_WIDTH, radii, SCREEN_GUTTER, spacing } from '@/theme';

import { ParticleBurst } from './ParticleBurst';

const VISIBLE_MS = 3400;

/** Shows queued celebration toasts one at a time, over every screen. */
export function ToastHost() {
  const toast = useToastStore((state) => state.queue[0]);
  if (!toast) return null;
  return <ToastBanner key={toast.id} toast={toast} />;
}

function ToastBanner({ toast }: { toast: Toast }) {
  const insets = useSafeAreaInsets();
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + spacing.sm }]}>
      <Animated.View
        style={{
          animationName: {
            '0%': { opacity: 0, transform: [{ translateY: -60 }, { scale: 0.9 }] },
            '12%': { opacity: 1, transform: [{ translateY: 6 }, { scale: 1.02 }] },
            '18%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
            '88%': { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
            '100%': { opacity: 0, transform: [{ translateY: -40 }, { scale: 0.96 }] },
          },
          animationDuration: VISIBLE_MS,
          animationFillMode: 'forwards',
        }}
      >
        <Pressable
          testID={toast.testID}
          accessibilityRole="alert"
          accessibilityLabel={`${toast.title} ${toast.message ?? ''}`}
          onPress={() => dismiss(toast.id)}
          style={styles.banner}
        >
          <View style={styles.icon}>
            <Icon name={toast.icon} size={24} color="textInverse" />
            <ParticleBurst
              x={22}
              y={22}
              delay={250}
              count={14}
              radius={60}
              size={7}
              gravity={20}
              duration={800}
              shapes={['star', 'confetti', 'circle']}
              colors={[colors.primary, colors.success, '#FFFFFF']}
              seed={toast.id}
            />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong" color="primary">
              {toast.title}
            </AppText>
            {toast.message ? (
              <AppText variant="small" color="textSecondary" numberOfLines={2}>
                {toast.message}
              </AppText>
            ) : null}
          </View>
          {toast.xp ? (
            <View style={styles.xp}>
              <Icon name="lightning-bolt" size={14} color={colors.xp} />
              <AppText variant="smallStrong" color={colors.xp}>
                +{toast.xp}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    zIndex: 1000,
  },
  banner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - SCREEN_GUTTER * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.primary,
    boxShadow: '0px 10px 30px rgba(0,0,0,0.55)',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(243, 184, 71, 0.14)',
  },
});
