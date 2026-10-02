import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Content pinned above the scrolling area (e.g. a header). */
  header?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  onScroll?: ScrollViewProps['onScroll'];
  gutter?: boolean;
  testID?: string;
}

/** Standard tab screen: safe-area aware, phone-width content, dark background. */
export function Screen({ children, scroll = true, header, scrollRef, onScroll, gutter = true, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = gutter ? SCREEN_GUTTER : 0;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      {header ? <View style={[styles.header, { paddingHorizontal: padding }]}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: padding }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, styles.content, { paddingHorizontal: padding }]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
});
