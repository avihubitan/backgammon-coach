import { useLocalSearchParams } from 'expo-router';

import { PracticeSessionScreen } from '@/features/practice/PracticeSessionScreen';

export default function PracticeRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  return <PracticeSessionScreen key={kind} kind={kind ?? ''} />;
}
