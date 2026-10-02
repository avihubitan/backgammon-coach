import { Text } from 'react-native';

import { colors, fontFamilies } from '@/theme';

import { AppText, type AppTextProps } from './AppText';

interface RichTextProps extends AppTextProps {
  children: string;
  /** Colour for **emphasised** words. */
  emphasisColor?: string;
}

/** Renders text with **bold** segments, used for key terms in lessons. */
export function RichText({ children, emphasisColor = colors.text, ...rest }: RichTextProps) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <AppText {...rest}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={index} style={{ fontFamily: fontFamilies.extrabold, color: emphasisColor }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </AppText>
  );
}

/** Strips **bold** markers for plain-text uses such as accessibility labels. */
export function plainText(text: string): string {
  return text.replaceAll('**', '');
}
