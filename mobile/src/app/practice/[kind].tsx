import { useLocalSearchParams } from 'expo-router';

import { PracticeSessionScreen } from '@/features/practice/PracticeSessionScreen';
import { launchSource } from '@/services/analytics';

export default function PracticeRoute() {
  const { kind, focus, source, position, daily } = useLocalSearchParams<{
    kind: string;
    focus?: string;
    source?: string;
    position?: string;
    daily?: string;
  }>();
  return (
    <PracticeSessionScreen
      key={`${kind}-${focus ?? ''}-${position ?? ''}-${daily ?? ''}`}
      kind={kind ?? ''}
      focus={focus}
      position={position}
      daily={daily === '1'}
      source={launchSource(source)}
    />
  );
}
