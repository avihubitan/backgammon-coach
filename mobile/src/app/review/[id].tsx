import { useLocalSearchParams } from 'expo-router';

import { GameReviewScreen } from '@/features/ai/GameReviewScreen';

export default function ReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GameReviewScreen gameId={id ?? ''} />;
}
