import { memo } from 'react';
import Svg, { Defs, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { boardColors } from '@/theme';

import { columnX, isTopPoint, type BoardMetrics } from './geometry';

interface BoardArtProps {
  metrics: BoardMetrics;
}

/** Static board artwork: walnut frame, felt, points, bar and bear-off tray. */
function BoardArtImpl({ metrics: m }: BoardArtProps) {
  const innerHeight = m.innerBottom - m.innerTop;
  const halfWidth = 6 * m.col;
  const tipLength = m.pointLength * 0.94;

  const triangles = [];
  for (let point = 1; point <= 24; point++) {
    const x = columnX(m, point);
    const top = isTopPoint(point);
    const columnParity = (top ? point - 13 : 12 - point) % 2;
    const dark = top ? columnParity === 0 : columnParity === 1;
    const baseY = top ? m.innerTop : m.innerBottom;
    const tipY = top ? m.innerTop + tipLength : m.innerBottom - tipLength;
    const inset = m.col * 0.04;
    triangles.push(
      <Polygon
        key={point}
        points={`${x + inset},${baseY} ${x + m.col - inset},${baseY} ${x + m.col / 2},${tipY}`}
        fill={`url(#${dark ? 'dark' : 'light'}${top ? 'Top' : 'Bottom'})`}
      />,
    );
  }

  return (
    <Svg width={m.width} height={m.height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.frameTop} />
          <Stop offset="1" stopColor={boardColors.frameBottom} />
        </LinearGradient>
        <LinearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={boardColors.barBottom} />
          <Stop offset="0.5" stopColor={boardColors.barTop} />
          <Stop offset="1" stopColor={boardColors.barBottom} />
        </LinearGradient>
        <RadialGradient id="felt" cx="50%" cy="50%" rx="70%" ry="70%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={boardColors.feltCenter} />
          <Stop offset="1" stopColor={boardColors.feltEdge} />
        </RadialGradient>
        <LinearGradient id="lightTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.pointLightBase} />
          <Stop offset="1" stopColor={boardColors.pointLightTip} />
        </LinearGradient>
        <LinearGradient id="lightBottom" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={boardColors.pointLightBase} />
          <Stop offset="1" stopColor={boardColors.pointLightTip} />
        </LinearGradient>
        <LinearGradient id="darkTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.pointDarkBase} />
          <Stop offset="1" stopColor={boardColors.pointDarkTip} />
        </LinearGradient>
        <LinearGradient id="darkBottom" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={boardColors.pointDarkBase} />
          <Stop offset="1" stopColor={boardColors.pointDarkTip} />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={m.width} height={m.height} rx={12} fill="url(#frame)" />
      <Rect
        x={1}
        y={1}
        width={m.width - 2}
        height={m.height - 2}
        rx={11}
        fill="none"
        stroke={boardColors.frameEdge}
        strokeOpacity={0.6}
        strokeWidth={1}
      />

      <Rect x={m.leftX} y={m.innerTop} width={halfWidth} height={innerHeight} fill="url(#felt)" rx={2} />
      <Rect x={m.rightX} y={m.innerTop} width={halfWidth} height={innerHeight} fill="url(#felt)" rx={2} />

      <G>{triangles}</G>

      <Rect x={m.barX} y={0} width={m.barWidth} height={m.height} fill="url(#bar)" />
      <Line
        x1={m.barX + m.barWidth / 2}
        y1={m.innerTop}
        x2={m.barX + m.barWidth / 2}
        y2={m.innerBottom}
        stroke="#000"
        strokeOpacity={0.25}
        strokeWidth={1}
      />

      <Rect
        x={m.trayX}
        y={m.innerTop}
        width={m.trayWidth}
        height={innerHeight}
        rx={4}
        fill={boardColors.trayFill}
        stroke={boardColors.trayEdge}
        strokeWidth={1}
      />
      <Line
        x1={m.trayX + 4}
        y1={m.midY}
        x2={m.trayX + m.trayWidth - 4}
        y2={m.midY}
        stroke={boardColors.trayEdge}
        strokeWidth={1}
      />
    </Svg>
  );
}

export const BoardArt = memo(BoardArtImpl);
