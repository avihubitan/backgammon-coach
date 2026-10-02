import { useLocalSearchParams } from 'expo-router';

import { PaywallScreen } from '@/features/monetization/PaywallScreen';

export default function PaywallRoute() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  return <PaywallScreen source={source ?? 'direct'} />;
}
