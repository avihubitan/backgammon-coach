import { View } from 'react-native';

import { BackgammonBoard, type BackgammonBoardProps } from '@/components/board/BackgammonBoard';
import type { BoardSetup, TapTarget } from '@/curriculum';
import { useSettingsStore } from '@/state/settingsStore';
import type { BoardHighlight, BoardRegion, HighlightTone } from '@/types/board';

type StepBoardProps = Omit<BackgammonBoardProps, 'showPointNumbers'> & {
  setup?: BoardSetup;
};

/** Board for lesson steps: applies the step's annotations and the learner's display settings. */
export function StepBoard({ setup, highlights, arrows, ...rest }: StepBoardProps) {
  const showNumbersSetting = useSettingsStore((state) => state.showPointNumbers);
  const showPointNumbers = setup?.showPointNumbers === false ? false : showNumbersSetting;
  return (
    <View style={{ alignItems: 'center' }}>
      <BackgammonBoard
        {...rest}
        showPointNumbers={showPointNumbers}
        highlights={[...(setup?.highlights ?? []), ...(highlights ?? [])]}
        arrows={[...(setup?.arrows ?? []), ...(arrows ?? [])]}
        cube={rest.cube ?? setup?.cube ?? null}
      />
    </View>
  );
}

export function regionForTarget(target: TapTarget): BoardRegion {
  if (target.kind === 'point') return { kind: 'point', point: target.point };
  return { kind: target.kind };
}

export function targetHighlights(targets: TapTarget[], tone: HighlightTone): BoardHighlight[] {
  return targets.map((target) => ({ region: regionForTarget(target), tone }));
}
