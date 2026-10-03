import { useLocalSearchParams } from 'expo-router';

import { PracticeSessionScreen } from '@/features/practice/PracticeSessionScreen';
import { launchSource } from '@/services/analytics';

export default function PracticeRoute() {
  const { kind, focus, source } = useLocalSearchParams<{ kind: string; focus?: string; source?: string }>();
  return (
    <PracticeSessionScreen key={`${kind}-${focus ?? ''}`} kind={kind ?? ''} focus={focus} source={launchSource(source)} />
  );
}
