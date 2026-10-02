import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { RichText } from '@/components/ui/RichText';
import { colors, SCREEN_GUTTER, spacing } from '@/theme';

interface StepHeaderProps {
  eyebrow?: string;
  text: string;
}

/** The short instruction above the board. */
export function StepHeader({ eyebrow, text }: StepHeaderProps) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? (
        <AppText variant="label" color="primary">
          {eyebrow}
        </AppText>
      ) : null}
      <RichText variant="callout" color="text" emphasisColor={colors.primary}>
        {text}
      </RichText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SCREEN_GUTTER,
    gap: spacing.xs,
    minHeight: 64,
    justifyContent: 'center',
  },
});
