import { useLocalSearchParams } from 'expo-router';

import { PracticeSessionScreen } from '@/features/practice/PracticeSessionScreen';

export default function PracticeRoute() {
  const { kind, focus } = useLocalSearchParams<{ kind: string; focus?: string }>();
  return <PracticeSessionScreen key={`${kind}-${focus ?? ''}`} kind={kind ?? ''} focus={focus} />;
}
