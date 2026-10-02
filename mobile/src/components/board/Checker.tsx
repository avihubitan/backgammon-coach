import { StyleSheet, View } from 'react-native';

import type { Player } from '@/game';
import { boardColors } from '@/theme';

interface CheckerFaceProps {
  player: Player;
  size: number;
}

/** A turned-wood style checker: rim, face, inner ring and a soft highlight. */
export function CheckerFace({ player, size }: CheckerFaceProps) {
  const light = player === 'player1';
  const face = light ? boardColors.lightCheckerFace : boardColors.darkCheckerFace;
  const rim = light ? boardColors.lightCheckerRim : boardColors.darkCheckerRim;
  const ring = light ? boardColors.lightCheckerRing : boardColors.darkCheckerRing;
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: rim,
        },
      ]}
    >
      <View
        style={{
          width: size * 0.84,
          height: size * 0.84,
          borderRadius: size,
          backgroundColor: face,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.52,
            height: size * 0.52,
            borderRadius: size,
            borderWidth: Math.max(1, size * 0.045),
            borderColor: ring,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: size * 0.08,
            left: size * 0.16,
            width: size * 0.34,
            height: size * 0.16,
            borderRadius: size,
            backgroundColor: light ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.12)',
            transform: [{ rotate: '-20deg' }],
          }}
        />
      </View>
    </View>
  );
}

/** Side view of a borne-off checker in the tray. */
export function CheckerSlab({ player, width, height }: { player: Player; width: number; height: number }) {
  const light = player === 'player1';
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 2,
        backgroundColor: light ? boardColors.lightCheckerFace : boardColors.darkCheckerFace,
        borderBottomWidth: Math.max(1, height * 0.3),
        borderBottomColor: light ? boardColors.lightCheckerRim : boardColors.darkCheckerRim,
      }}
    />
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1.5px 2.5px rgba(0, 0, 0, 0.5)',
  },
});
