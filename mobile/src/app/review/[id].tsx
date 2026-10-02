import { useLocalSearchParams } from 'expo-router';

import { GameReviewScreen } from '@/features/ai/GameReviewScreen';

export default function ReviewRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  return <GameReviewScreen gameId={id ?? ''} source={from === 'history' ? 'history' : 'game_result'} />;
}
