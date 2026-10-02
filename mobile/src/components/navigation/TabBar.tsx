import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { haptics } from '@/services/haptics';
import { colors, radii, spacing } from '@/theme';

export const TAB_ITEMS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home-variant' },
  learn: { label: 'Learn', icon: 'map-marker-path' },
  play: { label: 'Play', icon: 'dice-multiple' },
  practice: { label: 'Practice', icon: 'target' },
  profile: { label: 'Profile', icon: 'account-circle' },
};

interface TabBarExtraProps {
  /** Route names to show with a small lock badge. */
  locked?: string[];
}

export function TabBar({ state, navigation, locked = [] }: BottomTabBarProps & TabBarExtraProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const item = TAB_ITEMS[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const isLocked = locked.includes(route.name);
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={isLocked ? `${item.label}, locked` : item.label}
            onPress={onPress}
            style={styles.item}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name={item.icon} size={24} color={focused ? colors.primary : colors.textMuted} />
              {isLocked ? (
                <View style={styles.lock}>
                  <Icon name="lock" size={10} color={colors.textSecondary} />
                </View>
              ) : null}
            </View>
            <AppText variant="caption" color={focused ? 'primary' : 'textMuted'} style={styles.label}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52 },
  iconWrap: {
    width: 52,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  lock: {
    position: 'absolute',
    right: 6,
    bottom: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11 },
});
